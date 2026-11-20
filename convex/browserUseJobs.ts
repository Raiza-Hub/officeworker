"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from "convex/values";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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
  sleep,
  RUN_KEEP_ALIVE_SECONDS,
  POLL_INTERVAL_MS,
  DOWNLOAD_URL_TOLERANCE_MS,
  type SecretBinding,
} from "./browserUse";

const URL_TOLERANCE_MS = DOWNLOAD_URL_TOLERANCE_MS;
const UPLOAD_PUT_TIMEOUT_MS = 120_000;
const MAX_INGEST_FILES = 8;

function now() {
  return Date.now();
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_") || "file";
}

function isLikelyRelevantPath(path: string): boolean {
  return /\.(xlsx|xls|csv|pdf|txt|md|json|log|png|jpe?g|webp)$/i.test(path);
}

function guessContentType(path: string): string {
  if (/\.xlsx$/i.test(path)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (/\.xls$/i.test(path)) return "application/vnd.ms-excel";
  if (/\.csv$/i.test(path)) return "text/csv";
  if (/\.pdf$/i.test(path)) return "application/pdf";
  if (/\.txt$/i.test(path)) return "text/plain";
  if (/\.md$/i.test(path)) return "text/markdown";
  if (/\.json$/i.test(path)) return "application/json";
  if (/\.log$/i.test(path)) return "text/plain";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "application/octet-stream";
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

async function getFromR2(key: string): Promise<Uint8Array> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  const obj = await createR2Client(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  const body = obj.Body;
  if (!body) throw new Error(`Missing R2 object: ${key}`);
  return new Uint8Array(await body.transformToByteArray());
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

function truncateError(text: unknown, fallback: string): string {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return fallback;
  return raw.length > 500 ? `${raw.slice(0, 497)}...` : raw;
}

function formatArtifactList(submission: Doc<"submissions">): string {
  const outputs = submission.files.outputs ?? [];
  const inputs = submission.files.inputs ?? [];
  const lines: string[] = [];
  if (inputs.length > 0) {
    lines.push("Known input files (R2): " + inputs.map((f) => `${f.name} [key:${f.key}]`).join(", "));
  }
  if (outputs.length > 0) {
    lines.push("Known ingested outputs (R2): " + outputs.map((f) => `${f.name} [key:${f.key}]`).join(", "));
  }
  if (submission.files.uploadCandidate) {
    const c = submission.files.uploadCandidate;
    lines.push(`Current upload candidate: ${c.name} [key:${c.key}]`);
  }
  return lines.length ? lines.join("\n") : "No known ingested artifacts yet.";
}

function buildPortalTask(submission: Doc<"submissions">, portalUrl: string, intent: string, extraInstruction?: string) {
  const host = portalHostname(portalUrl);
  const base = [
    `You are automating a teacher portal workflow using Browser Use Cloud.`,
    `Portal URL: ${portalUrl}`,
    `Teacher goal: ${submission.goal}`,
    formatArtifactList(submission),
    `Authentication: if sign-in is required, use the provided secret bindings on ${host} — type the secret alias "portal_email" into the email/username field and "portal_password" into the password field, then submit the login form. Do not ask for credentials or expose secret values.`,
    intent === "upload"
      ? `Upload intent: locate the correct upload/submit area for the goal and upload the prepared file from the workspace (look under uploads/). Submit/confirm if the portal flow requires it.`
      : `Task intent: complete the goal in the portal as requested. Save any relevant produced/downloaded files into the workspace (prefer uploads/ or outputs/ with clear filenames).`,
    `Workspace files persist for this workspace; files uploaded to this workspace are restored under uploads/.`,
    `If you cannot complete the task (e.g. login fails, credentials rejected, CAPTCHA/MFA/OTP/SSO/device approval required, required page/option/file not found, ambiguous target, or repeated errors), stop and report the exact blocking reason and the page/step you reached. Do not ask the user to take action in a live browser.`,
    `When finished, report clearly what you did, which files (filenames/paths) were downloaded/produced/uploaded, and any ambiguity or missing information that requires the teacher's confirmation.`,
  ];
  if (extraInstruction?.trim()) base.push(`Additional instruction: ${extraInstruction.trim()}`);
  return base.join("\n");
}

async function stageInputsToWorkspace(
  ctx: any,
  submission: Doc<"submissions">,
  workspaceId: string,
  keys?: string[],
) {
  const wanted = new Set((keys ?? []).filter(Boolean));
  const candidates = (submission.files.inputs ?? []).filter((f) => wanted.size === 0 || wanted.has(f.key));
  const staged: string[] = [];
  for (const f of candidates) {
    const bytes = await getFromR2(f.key);
    const uploaded = await tolerantUploadToWorkspace({
      workspaceId,
      filename: f.name || sanitizeFileName(f.key),
      bytes,
      contentType: guessContentType(f.name || f.key),
    });
    staged.push(uploaded.filename);
  }
  if (staged.length > 0) {
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: submission._id,
      browserJobPatch: { intent: submission.browserJob?.intent ?? "portal_task", workspaceId },
      auditEvent: "browser_use_inputs_staged",
      auditDetail: { workspaceId, files: staged },
    });
  }
  return staged;
}

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

export const ensureConnectionProfile = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ profileId: string; created: boolean }> => {
    return await ensureConnectionProfileForUser(ctx, args.userId);
  },
});

async function startRunForSubmission(
  ctx: any,
  submissionId: Id<"submissions">,
  intent: string,
  extraInstruction?: string,
  stageInputKeys?: string[],
) {
  const submission: Doc<"submissions"> | null = await ctx.runQuery(internal.submissions.getSubmissionInternal, { submissionId });
  if (!submission) throw new Error("Submission not found");
  const conn = await ctx.runQuery(internal.workspace.getConnectionInternal, { userId: submission.userId });
  if (!conn) throw new Error("No workspace connection found");

  let profileId = conn.browserUseProfileId as string | undefined;
  if (!profileId) {
    const ensured = await ensureConnectionProfileForUser(ctx, submission.userId);
    profileId = ensured.profileId;
  }

  let workspaceId = submission.browserJob?.workspaceId as string | undefined;
  if (!workspaceId) {
    const ws: any = await createWorkspace(`sub-${String(submissionId)}`);
    workspaceId = String(ws?.id ?? ws?.workspaceId ?? ws?.workspace_id ?? "");
  }
  if (!workspaceId) throw new Error("Failed to create Browser Use workspace");

  if (stageInputKeys && stageInputKeys.length > 0) {
    await stageInputsToWorkspace(ctx, submission, workspaceId, stageInputKeys);
  }

  const task = buildPortalTask(submission, submission.portalUrl, intent, extraInstruction);
  const secretBindings = await getPortalSecretBindings(ctx, submission.userId, submission.portalUrl);
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
      phase: intent === "upload" ? "upload" : "portal_task",
      status: "queued",
      runId,
      sessionId,
      workspaceId: resolvedWs ?? workspaceId,
      profileId,
      lastSyncedAt: now(),
      attempts: (submission.browserJob?.attempts ?? 0) + 1,
      keepAliveUntil: now() + RUN_KEEP_ALIVE_SECONDS * 1000,
    },
    auditEvent: intent === "upload" ? "browser_use_upload_started" : "browser_use_task_started",
    auditDetail: {
      runId,
      sessionId,
      workspaceId: resolvedWs ?? workspaceId,
      profileId,
      model: configuredModel ?? "bu_default",
      secretBindings: "portal_email,portal_password",
    },
  });

  await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.browserUseJobs.pollSubmissionJob, { submissionId });
  return { runId, sessionId, workspaceId: resolvedWs ?? workspaceId, profileId };
}

export const startPortalJob = internalAction({
  args: {
    submissionId: v.id("submissions"),
    intent: v.optional(v.string()),
    extraInstruction: v.optional(v.string()),
    stageInputKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await startRunForSubmission(
      ctx,
      args.submissionId,
      args.intent ?? "portal_task",
      args.extraInstruction,
      args.stageInputKeys,
    );
  },
});

export const startUploadJob = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args): Promise<{ runId: string; sessionId?: string; workspaceId?: string; profileId: string }> => {
    const submission: Doc<"submissions"> | null = await ctx.runQuery(internal.submissions.getSubmissionInternal, { submissionId: args.submissionId });
    if (!submission) throw new Error("Submission not found");
    const candidate = submission.files.uploadCandidate;
    if (!candidate) throw new Error("No upload candidate is set for this submission");

    let workspaceId = submission.browserJob?.workspaceId;
    if (!workspaceId) {
      const ws: { id?: string; workspaceId?: string; workspace_id?: string } = await createWorkspace(`sub-${String(args.submissionId)}`);
      workspaceId = String(ws?.id ?? ws?.workspaceId ?? ws?.workspace_id ?? "");
    }
    if (!workspaceId) throw new Error("Failed to create Browser Use workspace");

    const bytes = await getFromR2(candidate.key);
    await tolerantUploadToWorkspace({
      workspaceId,
      filename: candidate.name || "upload-candidate",
      bytes,
      contentType: guessContentType(candidate.name || candidate.key),
    });

    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId,
      browserJobPatch: { intent: "upload", workspaceId, phase: "upload" },
      auditEvent: "browser_use_upload_candidate_staged",
      auditDetail: { workspaceId, filename: candidate.name, key: candidate.key },
    });

    return await startRunForSubmission(
      ctx,
      args.submissionId,
      "upload",
      `Upload the prepared file named "${candidate.name}" from the workspace (look under uploads/) for this goal, then submit/confirm if required.`,
    );
  },
});

async function ingestRunOutputs(ctx: any, submission: Doc<"submissions">, run: any, intent: string) {
  const workspaceId = submission.browserJob?.workspaceId;
  if (!workspaceId) throw new Error("No Browser Use workspace to ingest from");
  let files: Array<{ path: string; bytes: Uint8Array; size: number }> = [];
  try {
    files = await downloadWorkspaceFilesTolerant({
      workspaceId,
      deadlineMs: URL_TOLERANCE_MS,
      pathHints: [".xlsx", ".xls", ".csv", ".pdf", ".txt", ".md", ".json", "output", "uploads", "sheet", "result"],
    });
  } catch (e) {
    // No downloadable outputs: for uploads treat a successful run as completed (charge on done)
    // to avoid leaving funds reserved/stuck; for non-upload tasks move to awaiting_review.
    const nextStatus = intent === "upload" ? "done" : "awaiting_review";
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: submission._id,
      status: nextStatus,
      error: undefined,
      browserJobPatch: {
        intent,
        status: "completed",
        phase: intent === "upload" ? "done" : "completed_no_outputs",
        lastSyncedAt: now(),
        resultSummary: truncateError(
          (run as any)?.result ?? (intent === "upload"
            ? "Upload completed (no downloadable receipt/output captured)"
            : "Completed (no downloadable outputs found)"),
          "Completed",
        ),
      },
      auditEvent: intent === "upload" ? "browser_use_upload_completed_no_outputs" : "browser_use_completed_no_outputs",
      auditDetail: { intent, error: e instanceof Error ? e.message : String(e), result: (run as any)?.result ?? null },
    });
    return;
  }

  let candidates = files.filter((f) => f.path);
  const relevant = candidates.filter((f) => isLikelyRelevantPath(f.path));
  if (relevant.length > 0) candidates = relevant;
  // keep bounded number of artifacts
  candidates = candidates.slice(0, MAX_INGEST_FILES);
  const existingKeys = new Set((submission.files.outputs ?? []).map((o) => o.key));
  const newOutputs: Array<{ key: string; name: string; size: number; sourcePath: string }> = [];

  for (const file of candidates) {
    const originalName = sanitizeFileName(file.path.split(/[\\/]/).pop() || "output.bin");
    const baseKey = `submissions/${submission._id}/outputs/${sanitizeFileName(file.path).replace(/^_+/, "") || originalName}`;
    let key = baseKey;
    if (existingKeys.has(key)) {
      key = `submissions/${submission._id}/outputs/${Date.now()}-${originalName}`;
    }
    await putToR2(key, file.bytes, guessContentType(originalName));
    existingKeys.add(key);
    newOutputs.push({ key, name: originalName, size: file.size, sourcePath: file.path });
  }

  const nextStatus = intent === "upload" ? "done" : "awaiting_review";
  await ctx.runMutation(internal.submissions.updateSubmission, {
    submissionId: submission._id,
    status: nextStatus,
    error: undefined,
    appendOutputs: newOutputs.length > 0 ? newOutputs : undefined,
    browserJobPatch: {
      intent,
      status: "completed",
      phase: nextStatus === "done" ? "done" : "awaiting_review",
      lastSyncedAt: now(),
      resultSummary: truncateError(
        (run as any)?.result ?? (newOutputs.length ? `Ingested ${newOutputs.length} output file(s)` : "Completed"),
        "Completed",
      ),
    },
    auditEvent: intent === "upload" ? "browser_use_upload_completed" : "browser_use_outputs_ingested",
    auditDetail: {
      intent,
      outputs: newOutputs,
      result: (run as any)?.result ?? null,
    },
  });
}

function classifyTerminal(
  submission: Doc<"submissions">,
  run: any,
): { submissionStatus: Doc<"submissions">["status"]; error?: string } {
  const status = String(run?.status ?? "").toLowerCase();
  const detail = `${run?.error ?? ""} ${run?.result ?? ""} ${JSON.stringify(run?.output ?? "")}`.toLowerCase();
  const message = truncateError(run?.error || run?.result, "Browser automation failed");

  if (status === "completed") {
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
        const ev = await drainRunEvents(job.runId, nextEventCursor ?? null);
        if (typeof ev.nextAfter === "number" && Number.isFinite(ev.nextAfter)) {
          nextEventCursor = ev.nextAfter;
        }
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: submission._id,
          browserJobPatch: {
            intent: job.intent,
            status,
            lastEventCursor: nextEventCursor,
            lastSyncedAt: now(),
          },
        });
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
        try {
          await ingestRunOutputs(ctx, submission, run, job.intent || "portal_task");
        } catch (e) {
          await ctx.runMutation(internal.submissions.updateSubmission, {
            submissionId: submission._id,
            status: job.intent === "upload" ? "failed" : "failed",
            error: e instanceof Error ? `Output ingest failed: ${e.message}` : "Output ingest failed",
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
      } else {
        const mapped = classifyTerminal(submission, run);
        const nextStatus = mapped.submissionStatus;
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
      if (!job.syncDisabled) {
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS * 2, internal.browserUseJobs.pollSubmissionJob, { submissionId: args.submissionId });
      }
      return { ok: false, reason: "poll_error" };
    }
  },
});

export const resumeOrRetrySubmission = internalAction({
  args: { submissionId: v.id("submissions"), extraInstruction: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const submission: Doc<"submissions"> | null = await ctx.runQuery(internal.submissions.getSubmissionInternal, { submissionId: args.submissionId });
    if (!submission) throw new Error("Submission not found");
    const job = submission.browserJob;

    if (submission.status === "failed" || submission.status === "login_failed" || submission.status === "cancelled") {
      // If an upload failed after a candidate was prepared, return to review so teacher can explicitly approve again.
      if (submission.files.uploadCandidate && (job?.intent === "upload" || submission.chargeStatus === "reserved")) {
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: args.submissionId,
          status: "awaiting_review",
          error: undefined,
          auditEvent: "retry_ready_for_review",
          auditDetail: { from: submission.status, intent: job?.intent ?? null },
        });
        return { action: "moved_to_review" as const };
      }
      const intent = job?.intent && job.intent !== "upload" ? job.intent : "portal_task";
      await ctx.runMutation(internal.submissions.updateSubmission, {
        submissionId: args.submissionId,
        status: "preparing",
        error: undefined,
        auditEvent: "browser_use_retry_restart",
        auditDetail: { previousIntent: job?.intent ?? null, restartIntent: intent },
      });
      await startRunForSubmission(ctx, args.submissionId, intent, args.extraInstruction);
      return { action: "restarted" as const };
    }

    if (submission.status === "awaiting_review" && args.extraInstruction?.trim()) {
      // Continue the chained flow on the same workspace/submission with a new instruction.
      await ctx.runMutation(internal.submissions.updateSubmission, {
        submissionId: args.submissionId,
        status: "preparing",
        error: undefined,
        auditEvent: "browser_use_continue",
        auditDetail: { intent: job?.intent ?? "portal_task" },
      });
      await startRunForSubmission(ctx, args.submissionId, job?.intent ?? "portal_task", args.extraInstruction);
      return { action: "continued" as const };
    }

    return { action: "noop" as const };
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
