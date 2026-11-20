import { createTool } from "@convex-dev/agent";
import { ConvexError } from "convex/values";
import { z } from "zod/v3";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function billingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string } | string | undefined;
    if (typeof data === "object" && typeof data?.message === "string") {
      return data.message;
    }
    if (typeof data === "string") return data;
  }
  return error instanceof Error ? error.message : fallback;
}

export const getConnectionStatusTool = createTool({
  description:
    "Check whether the teacher's portal account/workspace connection is linked. " +
    "Returns connection status, linked portal email/URL, and Browser Use profile status. " +
    "Use this before any portal task.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<string> => {
    if (!ctx.userId) return "Not authenticated. Ask the teacher to sign in.";
    const status = await ctx.runQuery(internal.workspace.getStatusByUserId, {
      userId: ctx.userId as Id<"users">,
    });
    if (status === null) {
      return "Disconnected: no portal account is linked to this workspace. Tell the teacher to open the workspace form and link their portal account (portal URL + login email).";
    }
    const profile = status.browserUseProfileId
      ? `browser profile: ${status.browserUseProfileId} (${status.browserUseProfileStatus ?? "unknown"})`
      : "browser profile: not created yet (will be created on first portal task)";
    if (status.status === "connected") {
      return `Connected as ${status.portalEmail} (${status.portalUrl}). ${profile}.`;
    }
    return `Connection error as ${status.portalEmail} (${status.portalUrl})${status.lastError ? `: ${status.lastError}` : ""}. ${profile}. Tell the teacher to update their workspace connection details if needed.`;
  },
});

export const checkWalletBalanceTool = createTool({
  description:
    "Check the teacher's available wallet balance against the price for one successful portal upload. " +
    "Basic costs ₦500; Pro costs ₦1,000. Use this before creating a portal job that may lead to an upload.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<string> => {
    if (!ctx.userId) return "Not authenticated. Ask the teacher to sign in.";
    const balance = await ctx.runQuery(internal.billing.checkBalanceByUserId, {
      userId: ctx.userId as Id<"users">,
    });
    if (!balance.sufficient) {
      if (balance.available <= 0) {
        return "You’ve run out of credits. Add credits to continue this chat.";
      }
      return "You don’t have enough credits to complete this request. Add more credits to continue.";
    }
    return `Wallet check passed: ₦${balance.available.toLocaleString()} available; a successful ${balance.plan} upload costs ₦${balance.requiredAmount.toLocaleString()}.`;
  },
});

const inputFileSchema = z.object({
  key: z.string(),
  name: z.string(),
  size: z.number().optional(),
});

export const createPortalJobTool = createTool({
  description:
    "Create a generic portal submission/job and launch a Browser Use Cloud task for the teacher's goal. " +
    "The goal and any relevant attached/uploaded files/parsed context should come from the user's prompt and available files (agent-judged). " +
    "Portal login is attempted with stored credentials via secure secret bindings (best-effort, no live browser handoff). " +
    "Use stageInputKeys to stage specific known input files into the Browser Use workspace (uploads/) before the run when needed for the task. " +
    "Workspace is reused across runs for artifact handoff in the same submission chain.",
  inputSchema: z.object({
    goal: z.string().describe("Natural-language goal/task to accomplish in the linked portal"),
    attachments: z
      .array(inputFileSchema)
      .optional()
      .describe("Relevant R2 files/attachments known for this request (inputs/context)"),
    stageInputKeys: z
      .array(z.string())
      .optional()
      .describe("R2 keys of input files to stage into the Browser Use workspace uploads/ before the run"),
    extraInstruction: z
      .string()
      .optional()
      .describe("Optional additional instruction for this run (e.g. where to look, which file to use), derived from the prompt/files"),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    const status = await ctx.runQuery(internal.workspace.getStatusByUserId, {
      userId: ctx.userId as Id<"users">,
    });
    if (!status || status.status !== "connected") {
      return "Cannot start: no connected portal account is linked. Tell the teacher to open the workspace form and link their portal account.";
    }
    const submissionId = await ctx.runMutation(internal.submissions.createSubmissionDraft, {
      userId: ctx.userId as Id<"users">,
      adapterId: status.adapterId,
      portalUrl: status.portalUrl,
      threadId: ctx.threadId,
      goal: input.goal,
      inputs: input.attachments ?? [],
    });
    await ctx.runAction(internal.browserUseJobs.startPortalJob, {
      submissionId,
      intent: "portal_task",
      extraInstruction: input.extraInstruction,
      stageInputKeys: input.stageInputKeys,
    });
    return `Portal job started (${submissionId}) on Browser Use Cloud for goal: "${input.goal}". ` +
      `I’ll work on ${status.portalUrl} using secure secret-based login (best-effort, no live handoff) and sync progress/results via polling. ` +
      `If an upload candidate is prepared, I’ll present it for your review and only upload after your explicit approval. ` +
      `If automation can’t complete (e.g. login challenge or portal issue) or required info/target is ambiguous, I’ll report clearly and ask you.`;
  },
});

export const continuePortalJobTool = createTool({
  description:
    "Continue a portal submission/job on the same Browser Use workspace/session chain with a new instruction " +
    "(e.g. use ingested outputs, locate upload area, or upload a specific prepared file). " +
    "Use for chained steps. Do not use to upload without an explicit teacher-approved upload candidate flow.",
  inputSchema: z.object({
    submissionId: z.string(),
    extraInstruction: z.string().describe("Next instruction for the chained run, based on prompt/files/state"),
    stageInputKeys: z.array(z.string()).optional(),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
      submissionId: input.submissionId as Id<"submissions">,
      userId: ctx.userId as Id<"users">,
    });
    if (!submission) return "Submission not found in your workspace.";
    await ctx.runAction(internal.browserUseJobs.startPortalJob, {
      submissionId: input.submissionId as Id<"submissions">,
      intent: submission.browserJob?.intent && submission.browserJob.intent !== "upload" ? submission.browserJob.intent : "portal_task",
      extraInstruction: input.extraInstruction,
      stageInputKeys: input.stageInputKeys,
    });
    return "Continued the portal job on the same workspace. I’ll sync progress/results via polling.";
  },
});

export const getSubmissionsTool = createTool({
  description:
    "Get submissions. With submissionId, returns the full submission (goal, status, files with keys including outputs/uploadCandidate, edits, error, and Browser Use job state). " +
    "Without submissionId, lists recent submissions.",
  inputSchema: z.object({ submissionId: z.string().optional() }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    if (input.submissionId) {
      const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
        submissionId: input.submissionId as Id<"submissions">,
        userId: ctx.userId as Id<"users">,
      });
      if (!submission) return "Submission not found in your workspace.";
      return JSON.stringify(
        {
          id: submission._id,
          status: submission.status,
          goal: submission.goal,
          files: submission.files,
          edits: submission.edits ?? [],
          browserJob: submission.browserJob
            ? {
                provider: submission.browserJob.provider,
                intent: submission.browserJob.intent,
                phase: submission.browserJob.phase ?? null,
                status: submission.browserJob.status ?? null,
                runId: submission.browserJob.runId ?? null,
                sessionId: submission.browserJob.sessionId ?? null,
                workspaceId: submission.browserJob.workspaceId ?? null,
                profileId: submission.browserJob.profileId ?? null,
                lastSyncedAt: submission.browserJob.lastSyncedAt ?? null,
                resultSummary: submission.browserJob.resultSummary ?? null,
                lastError: submission.browserJob.lastError ?? null,
              }
            : null,
          error: submission.error ?? null,
          chargeStatus: submission.chargeStatus ?? null,
        },
        null,
        2,
      );
    }
    const submissions = await ctx.runQuery(internal.submissions.listSubmissionsByUserId, {
      userId: ctx.userId as Id<"users">,
    });
    if (submissions.length === 0) return "No submissions yet.";
    return submissions
      .map((s) => {
        const goal = s.goal.length > 80 ? `${s.goal.slice(0, 77)}...` : s.goal;
        return `${s._id}: ${goal} — ${s.status}` +
          `${s.error ? ` (${s.error})` : ""}` +
          `${s.browserJob?.intent ? ` [job:${s.browserJob.intent}/${s.browserJob.status ?? "?"}]` : ""}`;
      })
      .join("\n");
  },
});

export const syncSubmissionJobTool = createTool({
  description:
    "Request an immediate Browser Use job sync/poll for a submission to refresh status and results/artifacts.",
  inputSchema: z.object({ submissionId: z.string() }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
      submissionId: input.submissionId as Id<"submissions">,
      userId: ctx.userId as Id<"users">,
    });
    if (!submission) return "Submission not found in your workspace.";
    await ctx.runAction(internal.browserUseJobs.syncSubmissionJobNow, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    return "Sync requested. Check the submission again shortly for updated status/results.";
  },
});

export const readFileTool = createTool({
  description:
    "Read a parseable file from the teacher's workspace and return its content as text " +
    "(spreadsheets/CSV/txt/md/json/log). Pass a storage key. " +
    "PDFs/images attached in chat are understood directly by the assistant (no read_file needed). " +
    "Unsupported/unreadable binaries: ask the teacher for a readable export; never guess.",
  inputSchema: z.object({
    key: z.string().describe("R2 storage key of the file to read"),
    name: z.string().optional().describe("Filename hint (improves type detection)"),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    return await ctx.runAction(internal.agentFiles.readFileAction, {
      key: input.key,
      name: input.name,
      userId: ctx.userId as Id<"users">,
    });
  },
});

export const editFileTool = createTool({
  description:
    "Apply cell edits to a spreadsheet (.xlsx/.csv) by A1 notation " +
    '(e.g. {"cell":"C7","value":32}). When submissionId is provided, the edited file is saved as the submission\'s upload candidate ' +
    "and the submission moves to awaiting_review — nothing is uploaded until the teacher explicitly approves. " +
    "Without submissionId, a versioned copy is saved (original unchanged). Never invent values.",
  inputSchema: z.object({
    key: z.string().describe("R2 storage key of the file to edit"),
    edits: z.array(
      z.object({
        cell: z.string().describe("A1 notation, e.g. C7"),
        value: z.union([z.string(), z.number(), z.null()]),
      }),
    ),
    submissionId: z
      .string()
      .optional()
      .describe("If set, saves as this submission's upload candidate for review"),
    name: z.string().optional().describe("Filename hint"),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    return await ctx.runAction(internal.agentFiles.editFileAction, {
      key: input.key,
      edits: input.edits,
      submissionId: input.submissionId as Id<"submissions"> | undefined,
      name: input.name,
      userId: ctx.userId as Id<"users">,
    });
  },
});

export const setUploadCandidateTool = createTool({
  description:
    "Set an existing workspace file (by storage key) as the submission's upload candidate and move it to awaiting_review. " +
    "Use when the correct file to upload is already available/identified (from outputs or edits). " +
    "If the correct file/target is ambiguous, ask the teacher to confirm instead of guessing.",
  inputSchema: z.object({
    submissionId: z.string(),
    key: z.string().describe("R2 storage key of the file to upload"),
    name: z.string().optional(),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    return await ctx.runAction(internal.agentFiles.setUploadCandidateAction, {
      submissionId: input.submissionId,
      key: input.key,
      name: input.name,
      userId: ctx.userId as Id<"users">,
    });
  },
});

export const approveSubmissionTool = createTool({
  description:
    "Approve a submission's prepared upload candidate for portal upload. ONLY call this when the teacher has explicitly confirmed " +
    'they want to submit (e.g. "yes, submit it", "approve upload"). Never call this on your own. ' +
    "Reserves funds on approval; if upload staging/start fails, funds are released and the submission returns to awaiting_review.",
  inputSchema: z.object({
    submissionId: z.string().describe("ID of the submission to approve"),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
      submissionId: input.submissionId as Id<"submissions">,
      userId: ctx.userId as Id<"users">,
    });
    if (!submission) return "Submission not found in your workspace.";
    if (submission.status !== "awaiting_review") {
      return `Cannot approve: submission is ${submission.status}, not awaiting_review. It must be ready for your review before approval.`;
    }
    if (!submission.files.uploadCandidate) {
      return "Cannot approve: no upload candidate is set for this submission yet.";
    }
    try {
      await ctx.runMutation(internal.submissions.reserveSubmissionCharge, {
        submissionId: input.submissionId as Id<"submissions">,
        userId: ctx.userId as Id<"users">,
      });
    } catch (error) {
      return billingErrorMessage(error, "Unable to reserve wallet funds for this upload.");
    }

    try {
      await ctx.runAction(internal.browserUseJobs.startUploadJob, {
        submissionId: input.submissionId as Id<"submissions">,
      });
    } catch (error) {
      try {
        await ctx.runMutation(internal.submissions.releaseSubmissionCharge, {
          submissionId: input.submissionId as Id<"submissions">,
          userId: ctx.userId as Id<"users">,
          reason: "upload_start_failed",
        });
      } catch {
        // best effort release; surface original error below
      }
      const message = error instanceof Error ? error.message : "Upload could not be started";
      return `Approval recorded but upload could not be started: ${message}. Reserved funds were released; the submission remains awaiting review so you can retry or adjust.`;
    }
    return "Approval received and funds reserved. I’ve started the portal upload for this submission and will track its progress.";
  },
});

export const retrySubmissionTool = createTool({
  description:
    "Retry/continue a submission that failed or was cancelled. Restarts portal automation using saved credentials via secure secret bindings (best-effort). " +
    "If an upload failed after an upload candidate was prepared, moves the submission back to awaiting_review so the teacher can explicitly approve again before upload.",
  inputSchema: z.object({
    submissionId: z.string().describe("ID of the submission to retry"),
    extraInstruction: z.string().optional().describe("Optional adjusted instruction for the retry, if needed"),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
      submissionId: input.submissionId as Id<"submissions">,
      userId: ctx.userId as Id<"users">,
    });
    if (!submission) return "Submission not found in your workspace.";
    if (
      submission.status !== "failed" &&
      submission.status !== "login_failed" &&
      submission.status !== "cancelled"
    ) {
      return `Submission is ${submission.status} — retry is only for failed, login_failed, or cancelled submissions.`;
    }
    const result = await ctx.runAction(internal.browserUseJobs.resumeOrRetrySubmission, {
      submissionId: input.submissionId as Id<"submissions">,
      extraInstruction: input.extraInstruction,
    });
    if (result.action === "moved_to_review") {
      return "The upload candidate is ready again for review. Please review and explicitly approve before I upload it.";
    }
    if (result.action === "restarted" || result.action === "continued") {
      return "Retry/continue started (portal automation with secure secret-based login). I’ll sync progress via polling.";
    }
    return "Nothing to retry right now. Check the submission status for details.";
  },
});

export const cancelSubmissionTool = createTool({
  description: "Cancel a submission that is in progress or stuck.",
  inputSchema: z.object({
    submissionId: z.string().describe("ID of the submission to cancel"),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
      submissionId: input.submissionId as Id<"submissions">,
      userId: ctx.userId as Id<"users">,
    });
    if (!submission) return "Submission not found in your workspace.";
    if (submission.status === "done" || submission.status === "cancelled") {
      return `Submission is already ${submission.status}.`;
    }
    await ctx.runAction(internal.browserUseJobs.cancelSubmissionJob, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    return "Submission cancelled.";
  },
});

export const agentTools = {
  get_connection_status: getConnectionStatusTool,
  check_wallet_balance: checkWalletBalanceTool,
  create_portal_job: createPortalJobTool,
  continue_portal_job: continuePortalJobTool,
  get_submissions: getSubmissionsTool,
  sync_submission_job: syncSubmissionJobTool,
  read_file: readFileTool,
  edit_file: editFileTool,
  set_upload_candidate: setUploadCandidateTool,
  approve_submission: approveSubmissionTool,
  retry_submission: retrySubmissionTool,
  cancel_submission: cancelSubmissionTool,
};
