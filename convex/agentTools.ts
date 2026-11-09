import { createTool } from "@convex-dev/agent";
import { z } from "zod/v3";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// The AI's only account tool. Linking/rotating credentials happens in the
// /create-workspace form, not through the assistant.
export const getConnectionStatusTool = createTool({
  description:
    "Check whether the teacher's portal account is linked to the workspace. " +
    "Returns connected / disconnected and the linked email. Use this before any " +
    "task that needs the portal.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<string> => {
    const status = await ctx.runQuery(api.workspace.getStatus, {});
    if (status === null) {
      return "Disconnected: no portal account is linked to this workspace. Tell the teacher to open Create workspace and link their portal account.";
    }
    if (status.status === "connected") {
      return `Connected as ${status.portalEmail}.`;
    }
    return `Connection error as ${status.portalEmail}${status.lastError ? `: ${status.lastError}` : ""}. Tell the teacher to re-enter their credentials in the workspace form.`;
  },
});

export const checkWalletBalanceTool = createTool({
  description:
    "Check the teacher's available wallet balance against the price for one " +
    "subject and term sheet before creating or uploading it. Basic costs ₦500; " +
    "Pro costs ₦1,000. Use this before proceeding with each sheet.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<string> => {
    const balance = await ctx.runQuery(api.billing.checkBalance, {});
    if (!balance.authenticated) return "Not authenticated. Ask the teacher to sign in.";
    if (!balance.sufficient) {
      return `Insufficient wallet balance: ₦${balance.available.toLocaleString()} available; this ${balance.plan} upload costs ₦${balance.requiredAmount.toLocaleString()}. Ask the teacher to add credits in Billing before proceeding.`;
    }
    return `Wallet check passed: ₦${balance.available.toLocaleString()} available; this ${balance.plan} subject-term upload costs ₦${balance.requiredAmount.toLocaleString()}.`;
  },
});

export const createSubmissionTool = createTool({
  description:
    "Start a term-sheet submission: creates the submission and launches the " +
    "portal pipeline (login, download template, extract scores from the " +
    "attachments, fill, and prepare a preview for review).",
  inputSchema: z.object({
    className: z.string().describe("e.g. SS1, JSS2"),
    subject: z.string().describe("e.g. Mathematics"),
    term: z.string().describe("e.g. First Term"),
    academicYear: z.string().describe("e.g. 2025/2026"),
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
    const balance = await ctx.runQuery(api.billing.checkBalance, {});
    if (!balance.authenticated) return "Not authenticated.";
    if (!balance.sufficient) {
      return `Cannot start this subject-term sheet: ₦${balance.available.toLocaleString()} available, and the ${balance.plan} plan requires ₦${balance.requiredAmount.toLocaleString()}. Ask the teacher to add credits in Billing.`;
    }
    const status = await ctx.runQuery(api.workspace.getStatus, {});
    if (status === null) {
      return "Cannot start: no portal account is linked. Tell the teacher to open Create workspace first.";
    }
    const submissionId = await ctx.runMutation(
      internal.submissions.createSubmissionDraft,
      {
        userId: ctx.userId as Id<"users">,
        portalKey: status.portalKey,
        threadId: ctx.threadId,
        className: input.className,
        subject: input.subject,
        term: input.term,
        academicYear: input.academicYear,
      },
    );
    await ctx.runAction(internal.triggerActions.triggerPortalLogin, {
      submissionId,
      userId: ctx.userId as Id<"users">,
      portalKey: status.portalKey,
      className: input.className,
      subject: input.subject,
      term: input.term,
      academicYear: input.academicYear,
    });
    return `Submission started (${submissionId}). I will download the ${input.subject} template for ${input.className}, ${input.term}, ${input.academicYear}, fill it from the attached records, and show you a preview to review before anything is uploaded.`;
  },
});

export const getSubmissionTool = createTool({
  description: "Get the status and mapped scores of a submission.",
  inputSchema: z.object({ submissionId: z.string() }),
  execute: async (ctx, input): Promise<string> => {
    const submission = await ctx.runQuery(api.submissions.getSubmission, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    return JSON.stringify(
      {
        status: submission.status,
        class: submission.className,
        subject: submission.subject,
        term: submission.term,
        academicYear: submission.academicYear,
        files: submission.files,
        error: submission.error ?? null,
        mappings: submission.mappings,
      },
      null,
      2,
    );
  },
});

export const listSubmissionsTool = createTool({
  description: "List the teacher's recent submissions with their statuses.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<string> => {
    const submissions = await ctx.runQuery(api.submissions.listSubmissions, {});
    if (submissions.length === 0) return "No submissions yet.";
    return submissions
      .map(
        (s) =>
          `${s._id}: ${s.className} ${s.subject}, ${s.term} ${s.academicYear} — ${s.status}${s.error ? ` (${s.error})` : ""}`,
      )
      .join("\n");
  },
});

export const updateScoreTool = createTool({
  description:
    "Correct a student's CA and/or EXAM score in a submission, then re-fill the " +
    "sheet so the preview updates. Use when the teacher says e.g. \"@file Ada's " +
    "exam score is 65\".",
  inputSchema: z.object({
    submissionId: z.string(),
    studentName: z.string(),
    ca: z.number().nullable().optional(),
    exam: z.number().nullable().optional(),
  }),
  execute: async (ctx, input): Promise<string> => {
    await ctx.runMutation(internal.submissions.updateScoreMapping, {
      submissionId: input.submissionId as Id<"submissions">,
      studentName: input.studentName,
      ca: input.ca ?? undefined,
      exam: input.exam ?? undefined,
      needsReview: false,
    });
    const submission = await ctx.runQuery(api.submissions.getSubmission, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    if (submission.status === "awaiting_review" && submission.files.template) {
      await ctx.runAction(internal.triggerActions.triggerPrepareRefill, {
        submissionId: input.submissionId,
        userId: ctx.userId as Id<"users">,
        portalKey: submission.portalKey,
      });
      return `Updated ${input.studentName} and re-filled the sheet. The preview will refresh shortly.`;
    }
    return `Updated ${input.studentName}.`;
  },
});

export const resolveNameMatchTool = createTool({
  description:
    "Tell the system which roster student an extracted name actually refers to " +
    "(fixes wrong fuzzy matches), then re-fills the sheet.",
  inputSchema: z.object({
    submissionId: z.string(),
    studentName: z.string().describe("the extracted/typo name"),
    matchedName: z.string().describe("the correct roster name"),
  }),
  execute: async (ctx, input): Promise<string> => {
    await ctx.runMutation(internal.submissions.updateScoreMapping, {
      submissionId: input.submissionId as Id<"submissions">,
      studentName: input.studentName,
      matchedName: input.matchedName,
      needsReview: false,
    });
    await ctx.runAction(internal.triggerActions.triggerPrepareRefill, {
      submissionId: input.submissionId,
      userId: ctx.userId as Id<"users">,
      portalKey: "diper",
    });
    return `Mapped "${input.studentName}" to "${input.matchedName}" and re-filled the sheet.`;
  },
});

export const approveSubmissionTool = createTool({
  description:
    "Approve a submission that is awaiting review and upload the filled sheet " +
    "to the portal. Only use when the teacher has explicitly confirmed.",
  inputSchema: z.object({ submissionId: z.string() }),
  execute: async (ctx, input): Promise<string> => {
    const submission = await ctx.runQuery(api.submissions.getSubmission, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    if (submission.status !== "awaiting_review") {
      return `Cannot approve: submission is ${submission.status}.`;
    }
    const needsReview = submission.mappings.filter((m) => m.needsReview);
    if (needsReview.length > 0) {
      return `Cannot approve yet: ${needsReview.length} student(s) need attention: ${needsReview
        .map((m) => m.matchedName ?? m.studentName)
        .join(", ")}. Fix these first.`;
    }
    let chargeReserved = false;
    try {
      await ctx.runMutation(internal.submissions.reserveSubmissionCharge, {
        submissionId: input.submissionId as Id<"submissions">,
        userId: ctx.userId as Id<"users">,
      });
      chargeReserved = true;
      await ctx.runAction(internal.triggerActions.triggerSubmitTermSheet, {
        submissionId: input.submissionId,
        userId: ctx.userId as Id<"users">,
        portalKey: submission.portalKey,
      });
    } catch (error) {
      if (chargeReserved) {
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: input.submissionId as Id<"submissions">,
          status: "failed",
          error: error instanceof Error ? error.message : "Could not start upload",
        }).catch(() => undefined);
      }
      return error instanceof Error ? error.message : "Could not start upload.";
    }
    return `Approved. Uploading ${submission.files.filled?.originalName ?? "the filled sheet"} to the portal now — I'll report when it's done.`;
  },
});

export const cancelSubmissionTool = createTool({
  description: "Cancel a submission that has not been uploaded yet.",
  inputSchema: z.object({ submissionId: z.string() }),
  execute: async (ctx, input): Promise<string> => {
    const submission = await ctx.runQuery(api.submissions.getSubmission, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    if (submission.status === "done" || submission.status === "submitting") {
      return `Cannot cancel: submission is already ${submission.status}.`;
    }
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: input.submissionId as Id<"submissions">,
      status: "cancelled",
      auditEvent: "cancelled",
    });
    return "Submission cancelled.";
  },
});

export const retrySubmissionTool = createTool({
  description:
    "Retry a failed submission from where it stopped (login or prepare).",
  inputSchema: z.object({ submissionId: z.string() }),
  execute: async (ctx, input): Promise<string> => {
    const submission = await ctx.runQuery(api.submissions.getSubmission, {
      submissionId: input.submissionId as Id<"submissions">,
    });
    if (
      submission.status !== "failed" &&
      submission.status !== "login_failed"
    ) {
      return `Nothing to retry: submission is ${submission.status}.`;
    }
    if (submission.status === "login_failed" || !submission.files.template) {
      await ctx.runAction(internal.triggerActions.triggerPortalLogin, {
        submissionId: input.submissionId,
        userId: ctx.userId as Id<"users">,
        portalKey: submission.portalKey,
        className: submission.className,
        subject: submission.subject,
        term: submission.term,
        academicYear: submission.academicYear,
      });
      return "Retrying: logging into the portal again.";
    }
    await ctx.runAction(internal.triggerActions.triggerPrepareRefill, {
      submissionId: input.submissionId,
      userId: ctx.userId as Id<"users">,
      portalKey: submission.portalKey,
    });
    return "Retrying: preparing the sheet from the stored template.";
  },
});

export const agentTools = {
  get_connection_status: getConnectionStatusTool,
  check_wallet_balance: checkWalletBalanceTool,
  create_submission: createSubmissionTool,
  get_submission: getSubmissionTool,
  list_submissions: listSubmissionsTool,
  update_score: updateScoreTool,
  resolve_name_match: resolveNameMatchTool,
  approve_submission: approveSubmissionTool,
  cancel_submission: cancelSubmissionTool,
  retry_submission: retrySubmissionTool,
};
