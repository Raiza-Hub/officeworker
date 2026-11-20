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
    const profile =
      status.browserUseProfileId
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
    "Check the teacher's available wallet balance against the price for one " +
    "subject and term sheet before creating or uploading it. Basic costs ₦500; " +
    "Pro costs ₦1,000. Use this before proceeding with each sheet.",
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
    return `Wallet check passed: ₦${balance.available.toLocaleString()} available; this ${balance.plan} subject-term upload costs ₦${balance.requiredAmount.toLocaleString()}.`;
  },
});

export const createSubmissionTool = createTool({
  description:
    "Start a generic term-sheet submission: creates the submission and launches a Browser Use Cloud job " +
    "to access the linked portal and download the requested term sheet/template (parameterized by class, subject, term, academic year). " +
    "Status/progress is synced via polling. Portal login is attempted with stored credentials via secure secret bindings (best-effort, no live browser handoff). " +
    "Once a template is ingested the submission becomes awaiting_scores — read score records and the template, " +
    "fill the sheet with edit_file (pass submissionId), and present it for review.",
  inputSchema: z.object({
    className: z.string().describe("Class/group name as used in the portal"),
    subject: z.string().describe("Subject name as used in the portal"),
    term: z.string().describe("Term/period as used in the portal"),
    academicYear: z.string().describe("Academic/session year as used in the portal"),
    attachments: z
      .array(
        z.object({
          key: z.string(),
          name: z.string(),
          mediaType: z.string(),
          size: z.number(),
        }),
      )
      .optional()
      .describe("R2-uploaded score records attached to the chat message"),
  }),
  execute: async (ctx, input): Promise<string> => {
    if (!ctx.userId) return "Not authenticated.";
    const balance = await ctx.runQuery(internal.billing.checkBalanceByUserId, {
      userId: ctx.userId as Id<"users">,
    });
    if (!balance.sufficient) {
      if (balance.available <= 0) {
        return "You’ve run out of credits. Add credits to continue this chat.";
      }
      return "You don’t have enough credits to complete this request. Add more credits to continue.";
    }
    const status = await ctx.runQuery(internal.workspace.getStatusByUserId, {
      userId: ctx.userId as Id<"users">,
    });
    if (!status || status.status !== "connected") {
      return "Cannot start: no connected portal account is linked. Tell the teacher to open the workspace form and link their portal account.";
    }
    const submissionId = await ctx.runMutation(
      internal.submissions.createSubmissionDraft,
      {
        userId: ctx.userId as Id<"users">,
        adapterId: status.adapterId,
        portalUrl: status.portalUrl,
        threadId: ctx.threadId,
        className: input.className,
        subject: input.subject,
        term: input.term,
        academicYear: input.academicYear,
      },
    );
    await ctx.runAction(internal.browserUseJobs.startDownloadJob, {
      submissionId,
    });
    const attachmentNote =
      input.attachments && input.attachments.length > 0
        ? ` I can read the attached records (${input.attachments.map((a) => `${a.name} [key: ${a.key}]`).join(", ")}) once the template is ready.`
        : "";
    return `Submission started (${submissionId}) on Browser Use Cloud (polling sync). I’ll access ${status.portalUrl} to download the ${input.subject} template for ${input.className}, ${input.term}, ${input.academicYear} using secure secret-based login (best-effort). ` +
      `When it reaches awaiting_scores I’ll read the score records and fill the sheet for your review before anything is uploaded. If automation can’t complete (e.g. login challenge or portal issue), I’ll report the error.${attachmentNote}`;
  },
});

export const getSubmissionsTool = createTool({
  description:
    "Get submissions. With submissionId, returns the full submission " +
    "(status, files with storage keys, edits, needsReview, error, and Browser Use job state). " +
    "Without submissionId, lists recent submissions with their statuses.",
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
          className: submission.className,
          subject: submission.subject,
          term: submission.term,
          academicYear: submission.academicYear,
          files: submission.files,
          edits: submission.edits ?? [],
          needsReview: submission.needsReview ?? false,
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
      .map((s) =>
        `${s._id}: ${s.className} ${s.subject}, ${s.term} ${s.academicYear} — ${s.status}` +
        `${s.error ? ` (${s.error})` : ""}` +
        `${s.browserJob?.intent ? ` [job:${s.browserJob.intent}/${s.browserJob.status ?? "?"}]` : ""}`,
      )
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
    "Read a file from the teacher's workspace and return its content as text " +
    "(spreadsheets/CSV become row text; .txt/.md/.json return raw text). " +
    "Pass the storage key (e.g. a submission template/filled key or a " +
    "document storageKey). PDFs/images cannot be returned as text — ask the " +
    "teacher to attach them to a chat message instead.",
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
    '(e.g. {"cell":"C7","value":32}). When submissionId is provided, the ' +
    "edited sheet is saved as the submission's filled file, the submission " +
    "moves to awaiting_review with needsReview=true — nothing is uploaded " +
    "until the teacher explicitly approves. " +
    "Without submissionId, a versioned copy is saved (original unchanged). " +
    "Never invent scores.",
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
      .describe("If set, saves as this submission's filled sheet for review"),
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

export const matchNamesTool = createTool({
  description:
    "Fuzzy-match a list of names (e.g. student names from extracted records) " +
    "against a list of candidate names (e.g. names from the template/portal). " +
    "Returns best matches with confidence scores. Use it to align records " +
    "before editing; never guess or force a low-confidence match — ask the " +
    "teacher to confirm ambiguous matches.",
  inputSchema: z.object({
    query: z.array(z.string()).describe("Names to match (from records)"),
    candidates: z
      .array(z.string())
      .describe("Candidate names to match against (from template)"),
  }),
  execute: async (ctx, input): Promise<string> => {
    return await ctx.runAction(internal.agentFiles.matchNamesAction, {
      query: input.query,
      candidates: input.candidates,
    });
  },
});

export const webSearchTool = createTool({
  description:
    "Search the web for factual information when needed (e.g. official " +
    "terminology or portal-related facts). Returns a short list of results " +
    "with titles, URLs, and snippets. Not for finding student scores.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results (default 5)"),
  }),
  execute: async (ctx, input): Promise<string> => {
    return await ctx.runAction(internal.webSearch.searchAction, {
      query: input.query,
      numResults: input.numResults,
    });
  },
});

export const approveSubmissionTool = createTool({
  description:
    "Approve a submission for upload to the portal. ONLY call this when the " +
    "teacher has explicitly confirmed they want to submit (e.g. \"yes, " +
    'submit it", "approve upload"). Never call this on your own — the ' +
    "teacher must confirm after reviewing the filled sheet.",
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
      return `Cannot approve: submission is ${submission.status}, not awaiting_review. The filled sheet must be reviewed before approval.`;
    }
    if (!submission.files.filled) {
      return "Cannot approve: no filled sheet has been prepared for this submission yet.";
    }
    if (submission.needsReview) {
      // explicit approval clears needsReview and allows reserved-funds + upload flow
    }
    try {
      await ctx.runMutation(internal.submissions.reserveSubmissionCharge, {
        submissionId: input.submissionId as Id<"submissions">,
        userId: ctx.userId as Id<"users">,
      });
    } catch (error) {
      return billingErrorMessage(error, "Unable to reserve wallet funds for this upload.");
    }

    await ctx.runAction(internal.browserUseJobs.startUploadJob, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    return "Approval received and funds reserved. I’ve started the portal upload for this submission and will track its progress.";
  },
});

export const retrySubmissionTool = createTool({
  description:
    "Retry a submission that failed or was cancelled. Restarts portal automation using saved credentials via secure secret bindings (best-effort). " +
    "If an upload failed after a filled sheet was prepared, moves the submission back to review so the teacher can explicitly approve again before upload.",
  inputSchema: z.object({
    submissionId: z.string().describe("ID of the submission to retry"),
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
    });
    if (result.action === "moved_to_review") {
      return "The filled sheet is ready again for review. Please review and explicitly approve before I upload it.";
    }
    return "Retry started (restarting portal automation with secure secret-based login). I’ll sync progress via polling.";
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
  create_submission: createSubmissionTool,
  get_submissions: getSubmissionsTool,
  sync_submission_job: syncSubmissionJobTool,
  read_file: readFileTool,
  edit_file: editFileTool,
  match_names: matchNamesTool,
  web_search: webSearchTool,
  approve_submission: approveSubmissionTool,
  retry_submission: retrySubmissionTool,
  cancel_submission: cancelSubmissionTool,
};
