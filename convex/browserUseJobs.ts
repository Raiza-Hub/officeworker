"use node";

import { v } from "convex/values";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { createR2Client, getR2Config } from "./r2";
import {
  createProfile,
  createRun,
  createWorkspace,
  createWorkspaceUploadUrls,
  downloadWorkspaceFilesTolerant,
  drainRunEvents,
  getBrowserUseConfiguredModel,
  getRun,
  getRunStatus,
  isSuccessRunStatus,
  isTerminalRunStatus,
  listAllWorkspaceFiles,
  queueSessionMessage,
  sleep,
  DOWNLOAD_URL_TOLERANCE_MS,
  RUN_KEEP_ALIVE_SECONDS,
  POLL_INTERVAL_MS,
  type SecretBinding,
} from "./browserUse";

const URL_TOLERANCE_MS = DOWNLOAD_URL_TOLERANCE_MS;
const UPLOAD_PUT_TIMEOUT_MS = 120_000;

function now() {
  return Date.now();
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_") || "file";
}

function isSpreadsheetPath(path: string): boolean {
  return /\.(xlsx|xls|csv)$/i.test(path);
}

async function putToR2(key: string, bytes: Uint8Array, contentType?: string) {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  await createR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
  );
}

function guessContentType(path: string): string {
  if (/\.xlsx$/i.test(path)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (/\.xls$/i.test(path)) return "application/vnd.ms-excel";
  if (/\.csv$/i.test(path)) return "text/csv";
  if (/\.pdf$/i.test(path)) return "application/pdf";
  return "application/octet-stream";
}

function toEventCursor(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

async function tolerantUploadToWorkspace(args: {
  workspaceId: string;
  filename: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  // Request fresh presigned upload URL(s) and PUT bytes, tolerating slow networks
  // and short-lived presigned URL expiry for ~5 minutes (re-request URL on failure).
  const deadline = Date.now() + URL_TOLERANCE_MS;
  let lastErr: unknown = null;
  const encodedName = sanitizeFileName(args.filename);
  while (Date.now() < deadline) {
    try {
      const up: any = await createWorkspaceUploadUrls({
        workspaceId: args.workspaceId,
        files: [{ name: encodedName, contentType: args.contentType, size: args.bytes.byteLength }],
        allowOverrides: true,
      });
      const uploads = Array.isArray(up?.files)
        ? up.files
        : Array.isArray(up?.uploads)
          ? up.uploads
          : Array.isArray(up)
            ? up
            : [];
      const item = uploads[0] ?? up;
      const putUrl = item?.uploadUrl ?? item?.upload_url ?? item?.url ?? item?.putUrl;
      if (!putUrl) throw new Error("Workspace upload URL missing from Browser Use response");
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), UPLOAD_PUT_TIMEOUT_MS);
      try {
        const putRes = await fetch(String(putUrl), {
          method: "PUT",
          headers: { "Content-Type": args.contentType },
          body: Buffer.from(args.bytes),
          signal: controller.signal,
        });
        if (!putRes.ok) throw new Error(`Workspace file upload failed (${putRes.status})`);
      } finally {
        clearTimeout(t);
      }
      return { filename: encodedName };
    } catch (e) {
      lastErr = e;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(5000, Math.max(1500, remaining > 30000 ? 4000 : 2000)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Workspace upload failed within tolerance window");
}

function portalHostname(portalUrl: string): string {
  try {
    return new URL(portalUrl).hostname;
  } catch {
    throw new Error("Invalid portal URL");
  }
}

async function getPortalSecretBindings(
  ctx: any,
  userId: Id<"users">,
  portalUrl: string,
): Promise<SecretBinding[]> {
  const creds = await ctx.runAction(internal.workspaceActions.getDecryptedCredentials, { userId });
  const host = portalHostname(portalUrl);
  return [
    {
      alias: "portal_email",
      source: { type: "inline", value: String(creds.portalEmail ?? "") },
      allowedDomains: [host],
    },
    {
      alias: "portal_password",
      source: { type: "inline", value: String(creds.password ?? "") },
      allowedDomains: [host],
    },
  ];
}

function buildDownloadTask(submission: Doc<"submissions">, portalUrl: string) {
  const host = portalHostname(portalUrl);
  return [
    `You are automating a teacher portal workflow for a term sheet.`,
    `Portal URL: ${portalUrl}`,
    `Target: class="${submission.className}", subject="${submission.subject}", term="${submission.term}", academicYear="${submission.academicYear}".`,
    `Authentication: if sign-in is required, use the provided secret bindings on ${host} — type the secret alias "portal_email" into the email/username field and "portal_password" into the password field, then submit the login form. Do not ask for credentials or expose secret values.`,
    `Goal: navigate to the correct section and download the official term sheet/template or score sheet for the requested class/subject/term/academic year.`,
    `Save any downloaded spreadsheet files into the workspace (prefer paths under uploads/ or outputs/ with clear filenames).`,
    `If you cannot complete the task (e.g. login fails, credentials rejected, CAPTCHA/MFA/OTP/SSO/device approval required, required page/option not found, or repeated errors), stop and report the exact blocking reason and the page/step you reached. Do not ask the user to take action in a live browser.`,
    `When finished, report exactly which file(s) were downloaded (filenames/paths) and any important notes. If you cannot find or download the requested sheet, explain why.`,
  ].join("\n");
}

function buildUploadTask(submission: Doc<"submissions">, portalUrl: string, filledName: string) {
  const host = portalHostname(portalUrl);
  return [
    `You are automating a teacher portal workflow for a term sheet upload.`,
    `Portal URL: ${portalUrl}`,
    `Target: class="${submission.className}", subject="${submission.subject}", term="${submission.term}", academicYear="${submission.academicYear}".`,
    `Authentication: if sign-in is required, use the provided secret bindings on ${host} — type the secret alias "portal_email" into the email/username field and "portal_password" into the password field, then submit the login form. Do not ask for credentials or expose secret values.`,
    `Goal: locate the upload/submit area for the requested term sheet and upload the prepared filled file named "${filledName}" from the workspace (look under uploads/). Submit/confirm if required by the portal flow.`,
    `If you cannot complete the task (e.g. login fails, credentials rejected, CAPTCHA/MFA/OTP/SSO/device approval required, upload option not found, or repeated errors), stop and report the exact blocking reason and the page/step you reached. Do not ask the user to take action in a live browser.`,
    `After submission, report the outcome clearly (success confirmation, reference/receipt if shown, or any error). Save any confirmation/receipt file to the workspace if possible.`,
  ].join("\n");
}

function truncateError(text: unknown, fallback: string): string {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return fallback;
  return raw.length > 500 ? `${raw.slice(0, 497)}...` : raw;
}

function classifyTerminal(
  submission: Doc<"submissions">,
  run: any,
): { submissionStatus: Doc<"submissions">["status"]; error?: string } {
  const status = String(run?.status ?? "").toLowerCase();
  const detail = `${run?.error ?? ""} ${run?.result ?? ""} ${JSON.stringify(run?.output ?? "")}`.toLowerCase();
  const message = truncateError(run?.error || run?.result, "Browser automation failed");

  if (status === "completed") {
    // handled by ingest/upload completion paths
    return { submissionStatus: submission.status };
  }

  const loginFail =
    detail.includes("invalid password") ||
    detail.includes("incorrect password") ||
    detail.includes("invalid credential") ||
    detail.includes("invalid login") ||
    detail.includes("wrong password") ||
    detail.includes("wrong email") ||
    detail.includes("authentication failed") ||
    detail.includes("login failed") ||
    detail.includes("could not log in") ||
    detail.includes("couldn't log in") ||
    detail.includes("unable to log in") ||
    detail.includes("unable to sign in") ||
    detail.includes("sign in failed");

  if (loginFail) {
    return {
      submissionStatus: "login_failed",
      error: truncateError(run?.error || run?.result, "Portal login failed"),
    };
  }

  if (status === "cancelled" || status === "canceled") {
    return { submissionStatus: "cancelled", error: "Browser automation was cancelled" };
  }

  return { submissionStatus: "failed", error: message };
}

export const ensureConnectionProfile = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ profileId: string; created: boolean }> => {
    const conn = await ctx.runQuery(internal.workspace.getConnectionInternal, { userId: args.userId });
    if (!conn) throw new Error("No workspace connection found");
    if (conn.browserUseProfileId) return { profileId: conn.browserUseProfileId, created: false };
    const created: any = await createProfile(`officeworker-${String(args.userId)}`);
    const profileId = String(created?.id ?? created?.profileId ?? created?.profile_id ?? "");
    if (!profileId) throw new Error("Failed to create Browser Use profile");
    await ctx.runMutation(internal.workspace.setBrowserUseProfile, {
      userId: args.userId,
      browserUseProfileId: profileId,
      browserUseProfileStatus: "unknown",
    });
    return { profileId, created: true };
  },
});

async function ensureConnectionProfileForUser(
  ctx: any,
  userId: Id<"users">,
): Promise<{ profileId: string; created: boolean }> {
  const conn = await ctx.runQuery(internal.workspace.getConnectionInternal, { userId });
  if (!conn) throw new Error("No workspace connection found");
  if (conn.browserUseProfileId) return { profileId: conn.browserUseProfileId, created: false };
  const created: any = await createProfile(`officeworker-${String(userId)}`);
  const profileId = String(created?.id ?? created?.profileId ?? created?.profile_id ?? "");
  if (!profileId) throw new Error("Failed to create Browser Use profile");
  await ctx.runMutation(internal.workspace.setBrowserUseProfile, {
    userId,
    browserUseProfileId: profileId,
    browserUseProfileStatus: "unknown",
  });
  return { profileId, created: true };
}

async function startRunForSubmission(ctx: any, submissionId: Id<"submissions">, intent: "download" | "upload") {
  const submission: Doc<"submissions"> | null = await ctx.runQuery(internal.submissions.getSubmissionInternal, { submissionId });
  if (!submission) throw new Error("Submission not found");
  const conn = await ctx.runQuery(internal.workspace.getConnectionInternal, { userId: submission.userId });
  if (!conn) throw new Error("No workspace connection found");

  let profileId = conn.browserUseProfileId as string | undefined;
  if (!profileId) {
    const ensured = await ensureConnectionProfileForUser(ctx, submission.userId);
    profileId = ensured.profileId;
  }

  // create or reuse workspace
  let workspaceId = submission.browserJob?.workspaceId as string | undefined;
  if (!workspaceId) {
    const ws: any = await createWorkspace(`sub-${String(submissionId)}`);
    workspaceId = String(ws?.id ?? ws?.workspaceId ?? ws?.workspace_id ?? "");
  }

  const task =
    intent === "upload"
      ? buildUploadTask(
          submission,
          submission.portalUrl,
          submission.files.filled?.originalName ?? "filled.xlsx",
        )
      : buildDownloadTask(submission, submission.portalUrl);

  const secretBindings = await getPortalSecretBindings(ctx, submission.userId, submission.portalUrl);

  // BU Cloud run agent model (optional, distinct from assistant AI_MODEL). If unset, BU uses its default.
  const configuredModel = getBrowserUseConfiguredModel();
  const { id: runId, sessionId, workspaceId: resolvedWs } = await createRun({
    task,
    workspaceId,
    profileId,
    keepAlive: RUN_KEEP_ALIVE_SECONDS,
    secretBindings,
    ...(configuredModel ? { model: configuredModel } : {}),
  });

  await ctx.runMutation(internal.submissions.updateSubmission, {
    submissionId,
    status: intent === "upload" ? "submitting" : "preparing",
    error: undefined,
    browserJob: {
      provider: "browser_use",
      intent,
      phase: intent === "upload" ? "upload_filled" : "download_template",
      status: "queued",
      runId,
      sessionId,
      workspaceId: resolvedWs ?? workspaceId,
      profileId,
      lastSyncedAt: now(),
      attempts: (submission.browserJob?.attempts ?? 0) + 1,
      keepAliveUntil: now() + RUN_KEEP_ALIVE_SECONDS * 1000,
    },
    auditEvent: intent === "upload" ? "browser_use_upload_started" : "browser_use_download_started",
    auditDetail: {
      runId,
      sessionId,
      workspaceId: resolvedWs ?? workspaceId,
      profileId,
      model: configuredModel ?? "bu_default",
      secretBindings: "portal_email,portal_password",
    },
  });

  // kick off polling (control hardening deferred)
  await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.browserUseJobs.pollSubmissionJob, { submissionId });
  return { runId, sessionId, workspaceId: resolvedWs ?? workspaceId, profileId };
}

export const startDownloadJob = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await startRunForSubmission(ctx, args.submissionId, "download");
  },
});

export const startUploadJob = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission: Doc<"submissions"> | null = await ctx.runQuery(internal.submissions.getSubmissionInternal, { submissionId: args.submissionId });
    if (!submission) throw new Error("Submission not found");
    if (!submission.files.filled) throw new Error("No filled sheet to upload");

    // ensure workspace exists and upload filled file into it before run
    let workspaceId = submission.browserJob?.workspaceId as string | undefined;
    if (!workspaceId) {
      const ws: any = await createWorkspace(`sub-${String(args.submissionId)}`);
      workspaceId = String(ws?.id ?? ws?.workspaceId ?? ws?.workspace_id ?? "");
    }
    if (!workspaceId) throw new Error("Failed to create Browser Use workspace");

    // fetch filled file bytes from R2 and upload to BU workspace (tolerant, ~5min)
    const config = getR2Config();
    if (!config) throw new Error("R2 is not configured");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const obj = await createR2Client(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: submission.files.filled.key }));
    const body = obj.Body;
    if (!body) throw new Error("Filled file missing in storage");
    const bytes = new Uint8Array(await body.transformToByteArray());
    await tolerantUploadToWorkspace({
      workspaceId,
      filename: submission.files.filled.originalName || "filled.xlsx",
      bytes,
      contentType: guessContentType(submission.files.filled.originalName || "filled.xlsx"),
    });

    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId,
      browserJobPatch: { intent: "upload", workspaceId, phase: "upload_filled" },
      auditEvent: "browser_use_filled_uploaded_to_workspace",
      auditDetail: { workspaceId, filename: submission.files.filled.originalName },
    });

    return await startRunForSubmission(ctx, args.submissionId, "upload");
  },
});

async function ingestDownloadArtifacts(ctx: any, submission: Doc<"submissions">) {
  const workspaceId = submission.browserJob?.workspaceId;
  if (!workspaceId) throw new Error("No Browser Use workspace to ingest from");
  // Tolerant download: re-lists workspace files (all pages) to refresh ~60s presigned URLs and retries for ~5min.
  const files = await downloadWorkspaceFilesTolerant({
    workspaceId,
    deadlineMs: URL_TOLERANCE_MS,
    pathHints: [".xlsx", ".xls", ".csv", "sheet", "template", "score", "output", "uploads"],
  });
  // choose best spreadsheet candidate
  const spreadsheets = files.filter((f) => isSpreadsheetPath(f.path));
  const chosen = spreadsheets[0] ?? files[0];
  if (!chosen) throw new Error("No files downloaded from portal workspace");
  const originalName = sanitizeFileName(chosen.path.split(/[\\/]/).pop() || "template.xlsx");
  const key = `submissions/${submission._id}/template/${originalName}`;
  await putToR2(key, chosen.bytes, guessContentType(originalName));

  await ctx.runMutation(internal.submissions.updateSubmission, {
    submissionId: submission._id,
    status: "awaiting_scores",
    error: undefined,
    templateKey: key,
    templateName: originalName,
    browserJobPatch: {
      intent: submission.browserJob?.intent ?? "download",
      status: "completed",
      phase: "awaiting_scores",
      lastSyncedAt: now(),
      resultSummary: `Downloaded ${originalName}`,
    },
    auditEvent: "browser_use_template_ingested",
    auditDetail: { key, originalName, files: files.map((f) => ({ path: f.path, size: f.size })) },
  });
}

async function markUploadCompleted(ctx: any, submission: Doc<"submissions">, run: any) {
  const status = String(run?.status ?? "").toLowerCase();
  if (status === "completed") {
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: submission._id,
      status: "done",
      error: undefined,
      browserJobPatch: {
        intent: "upload",
        status: "completed",
        phase: "done",
        lastSyncedAt: now(),
        resultSummary: truncateError(run?.result ?? "Uploaded successfully", "Uploaded successfully"),
      },
      auditEvent: "browser_use_upload_completed",
      auditDetail: { result: run?.result ?? null },
    });
    return;
  }
  const mapped = classifyTerminal(submission, run);
  const nextStatus =
    mapped.submissionStatus === submission.status || mapped.submissionStatus === "submitting"
      ? "failed"
      : mapped.submissionStatus;
  await ctx.runMutation(internal.submissions.updateSubmission, {
    submissionId: submission._id,
    status: nextStatus,
    error: mapped.error ?? "Upload did not complete successfully",
    browserJobPatch: {
      intent: "upload",
      status: String(run?.status ?? "failed"),
      lastSyncedAt: now(),
      lastError: mapped.error ?? String(run?.error ?? ""),
    },
    auditEvent: nextStatus === "login_failed" ? "browser_use_login_failed" : "browser_use_upload_failed",
    auditDetail: { status: run?.status, error: run?.error ?? null, result: run?.result ?? null },
  });
}

export const pollSubmissionJob = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission: Doc<"submissions"> | null = await ctx.runQuery(internal.submissions.getSubmissionInternal, { submissionId: args.submissionId });
    if (!submission) return { ok: false, reason: "not_found" };
    const job = submission.browserJob;
    if (!job?.runId) return { ok: false, reason: "no_job" };
    if (job.syncDisabled) return { ok: false, reason: "sync_disabled" };
    if (["done", "cancelled"].includes(submission.status) && isTerminalRunStatus(job.status)) {
      return { ok: true, terminal: true };
    }

    try {
      const statusResp = await getRunStatus(job.runId);
      const status = String((statusResp as any)?.status ?? (statusResp as any)?.state ?? "").toLowerCase();

      let nextEventCursor: number | undefined = toEventCursor(job.lastEventCursor);
      try {
        // Drain event pages (v4 nextAfter/hasMore) so we don't miss state/cues.
        const ev = await drainRunEvents(job.runId, nextEventCursor ?? null);
        if (typeof ev.nextAfter === "number" && Number.isFinite(ev.nextAfter)) {
          nextEventCursor = ev.nextAfter;
        }
        const prevCursor = toEventCursor(job.lastEventCursor);
        if (nextEventCursor !== prevCursor || ev.events.length > 0) {
          await ctx.runMutation(internal.submissions.updateSubmission, {
            submissionId: submission._id,
            browserJobPatch: {
              intent: job.intent,
              status,
              lastEventCursor: nextEventCursor,
              lastSyncedAt: now(),
            },
          });
        } else {
          await ctx.runMutation(internal.submissions.updateSubmission, {
            submissionId: submission._id,
            browserJobPatch: { intent: job.intent, status, lastSyncedAt: now() },
          });
        }
      } catch {
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: submission._id,
          browserJobPatch: { intent: job.intent, status, lastSyncedAt: now() },
        });
      }

      if (!isTerminalRunStatus(status)) {
        if (!job.syncDisabled && !["done", "cancelled", "failed", "login_failed"].includes(submission.status)) {
          await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.browserUseJobs.pollSubmissionJob, { submissionId: args.submissionId });
        }
        return { ok: true, terminal: false, status };
      }

      const run = await getRun(job.runId);
      const runStatus = String((run as any)?.status ?? status ?? "").toLowerCase();

      if (isSuccessRunStatus(runStatus)) {
        if (job.intent === "upload") {
          await markUploadCompleted(ctx, submission, run);
        } else {
          try {
            await ingestDownloadArtifacts(ctx, submission);
          } catch (e) {
            await ctx.runMutation(internal.submissions.updateSubmission, {
              submissionId: submission._id,
              status: "failed",
              error: e instanceof Error ? `Artifacts ingest failed: ${e.message}` : "Artifacts ingest failed",
              browserJobPatch: {
                intent: job.intent,
                status: runStatus,
                lastSyncedAt: now(),
                lastError: e instanceof Error ? e.message : String(e),
              },
              auditEvent: "browser_use_ingest_failed",
              auditDetail: { error: e instanceof Error ? e.message : String(e), result: (run as any)?.result ?? null },
            });
          }
        }
      } else {
        const mapped = classifyTerminal(submission, run);
        const nextStatus =
          job.intent === "upload" &&
          (mapped.submissionStatus === "preparing" || mapped.submissionStatus === submission.status)
            ? "failed"
            : mapped.submissionStatus;
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: submission._id,
          status: nextStatus,
          error: mapped.error ?? "Browser automation failed",
          browserJobPatch: {
            intent: job.intent,
            status: runStatus,
            lastSyncedAt: now(),
            lastError: mapped.error ?? String((run as any)?.error ?? ""),
          },
          auditEvent: nextStatus === "login_failed" ? "browser_use_login_failed" : "browser_use_failed",
          auditDetail: { status: runStatus, error: (run as any)?.error ?? null, result: (run as any)?.result ?? null },
        });
      }
      return { ok: true, terminal: true, status: runStatus };
    } catch (e) {
      await ctx.runMutation(internal.submissions.updateSubmission, {
        submissionId: submission._id,
        browserJobPatch: {
          intent: job.intent,
          lastSyncedAt: now(),
          lastError: e instanceof Error ? e.message : String(e),
        },
        auditEvent: "browser_use_poll_error",
        auditDetail: { error: e instanceof Error ? e.message : String(e) },
      });
      // schedule another poll attempt (basic; backoff deferred)
      if (!job.syncDisabled) {
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS * 2, internal.browserUseJobs.pollSubmissionJob, { submissionId: args.submissionId });
      }
      return { ok: false, reason: "poll_error" };
    }
  },
});

export const resumeOrRetrySubmission = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission: Doc<"submissions"> | null = await ctx.runQuery(internal.submissions.getSubmissionInternal, { submissionId: args.submissionId });
    if (!submission) throw new Error("Submission not found");
    const job = submission.browserJob;

    // If an upload previously failed but a filled sheet exists, move back to review
    // so the teacher can explicitly approve before any new upload attempt.
    if (
      submission.files.filled &&
      (job?.intent === "upload" || submission.status === "submitting" || job?.phase === "upload_filled") &&
      ["failed", "login_failed"].includes(submission.status)
    ) {
      await ctx.runMutation(internal.submissions.updateSubmission, {
        submissionId: args.submissionId,
        status: "awaiting_review",
        error: undefined,
        auditEvent: "retry_ready_for_review",
        auditDetail: { from: submission.status, phase: job?.phase ?? null },
      });
      return { action: "moved_to_review" as const };
    }

    // Restart automation with secret-based login (best-effort, no live HITL).
    const intent: "download" | "upload" =
      submission.files.filled && job?.intent === "upload" && submission.status === "awaiting_review"
        ? "upload"
        : "download";
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId,
      status: "preparing",
      error: undefined,
      auditEvent: "browser_use_retry_restart",
      auditDetail: { previousIntent: job?.intent ?? null, restartIntent: intent },
    });
    await startRunForSubmission(ctx, args.submissionId, intent);
    return { action: "restarted" as const };
  },
});

export const cancelSubmissionJob = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId,
      status: "cancelled",
      browserJobPatch: { intent: "cancelled", syncDisabled: true, lastSyncedAt: now() },
      auditEvent: "cancelled",
    });
    return { ok: true };
  },
});

export const syncSubmissionJobNow = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.browserUseJobs.pollSubmissionJob, { submissionId: args.submissionId });
    return { scheduled: true };
  },
});
