import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  activityFromSubmissions,
  addSubmissionActivity,
  applyActivityTransition,
  type SubmissionActivityCounts,
} from "../lib/submission-activity";
import {
  canApproveSubmission,
  canCancelSubmission,
  shouldRevertApprovalClaim,
  shouldRevertCancelClaim,
} from "../lib/submission-status";

const statusValidator = v.union(
  v.literal("preparing"),
  v.literal("awaiting_review"),
  v.literal("login_failed"),
  v.literal("submitting"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const appliedEditValidator = v.object({
  cell: v.string(),
  value: v.union(v.string(), v.number(), v.null()),
});

const browserJobValidator = v.object({
  provider: v.literal("browser_use"),
  intent: v.string(),
  phase: v.optional(v.string()),
  status: v.optional(v.string()),
  runId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  workspaceId: v.optional(v.string()),
  profileId: v.optional(v.string()),
  lastEventCursor: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
  keepAliveUntil: v.optional(v.number()),
  attempts: v.optional(v.number()),
  lastError: v.optional(v.string()),
  resultSummary: v.optional(v.string()),
  syncDisabled: v.optional(v.boolean()),
  reservationId: v.optional(v.id("usageReservations")),
  providerCostUsd: v.optional(v.number()),
  billingSettled: v.optional(v.boolean()),
});

const browserJobPatchValidator = v.object({
  intent: v.optional(v.string()),
  phase: v.optional(v.string()),
  status: v.optional(v.string()),
  runId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  workspaceId: v.optional(v.string()),
  profileId: v.optional(v.string()),
  lastEventCursor: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
  keepAliveUntil: v.optional(v.number()),
  attempts: v.optional(v.number()),
  lastError: v.optional(v.string()),
  resultSummary: v.optional(v.string()),
  syncDisabled: v.optional(v.boolean()),
  reservationId: v.optional(v.id("usageReservations")),
  providerCostUsd: v.optional(v.number()),
  billingSettled: v.optional(v.boolean()),
});

const artifactFileValidator = v.object({
  key: v.string(),
  name: v.string(),
  size: v.optional(v.number()),
  sourcePath: v.optional(v.string()),
});

async function getOwnedSubmission(
  ctx: QueryCtx,
  submissionId: Id<"submissions">,
  userId: Id<"users">,
) {
  const submission = await ctx.db.get(submissionId);
  if (submission === null || submission.userId !== userId) return null;
  return submission;
}

async function listOwnedSubmissions(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("submissions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);
}

async function readThreadActivityCounts(
  ctx: QueryCtx,
  userId: Id<"users">,
  threadId: string,
): Promise<SubmissionActivityCounts | null> {
  const existing = await ctx.db
    .query("submissionThreadActivity")
    .withIndex("by_user_thread", (q) =>
      q.eq("userId", userId).eq("threadId", threadId),
    )
    .unique();
  if (!existing) return null;
  return {
    visibleCount: existing.visibleCount,
    awaitingCount: existing.awaitingCount,
    hasAwaitingReview: existing.hasAwaitingReview,
  };
}

async function recomputeThreadActivity(
  ctx: QueryCtx,
  userId: Id<"users">,
  threadId: string,
): Promise<SubmissionActivityCounts> {
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_thread_user", (q) =>
      q.eq("threadId", threadId).eq("userId", userId),
    )
    .collect();
  return activityFromSubmissions(submissions);
}

async function upsertThreadActivity(
  ctx: MutationCtx,
  userId: Id<"users">,
  threadId: string,
  counts: SubmissionActivityCounts,
) {
  const existing = await ctx.db
    .query("submissionThreadActivity")
    .withIndex("by_user_thread", (q) =>
      q.eq("userId", userId).eq("threadId", threadId),
    )
    .unique();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { ...counts, updatedAt: now });
    return;
  }
  await ctx.db.insert("submissionThreadActivity", {
    userId,
    threadId,
    ...counts,
    updatedAt: now,
  });
}

export const createSubmissionDraft = internalMutation({
  args: {
    userId: v.id("users"),
    adapterId: v.string(),
    portalUrl: v.string(),
    threadId: v.optional(v.string()),
    goal: v.string(),
    inputs: v.optional(v.array(artifactFileValidator)),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("submissions", {
      userId: args.userId,
      adapterId: args.adapterId,
      portalUrl: args.portalUrl,
      threadId: args.threadId,
      goal: args.goal.trim(),
      status: "preparing",
      browserJob: undefined,
      files: { inputs: args.inputs ?? [], outputs: [] },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      submissionId: id,
      event: "created",
      detail: { goal: args.goal.trim() },
      at: now,
    });
    if (args.threadId) {
      const previousCounts = await readThreadActivityCounts(
        ctx,
        args.userId,
        args.threadId,
      );
      const counts = previousCounts
        ? addSubmissionActivity(previousCounts, "preparing")
        : await recomputeThreadActivity(ctx, args.userId, args.threadId);
      await upsertThreadActivity(ctx, args.userId, args.threadId, counts);
    }
    return id;
  },
});

export const updateSubmission = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    expectStatus: v.optional(v.string()),
    status: v.optional(statusValidator),
    error: v.optional(v.string()),
    appendOutputs: v.optional(v.array(artifactFileValidator)),
    uploadCandidate: v.optional(v.union(artifactFileValidator, v.null())),
    edits: v.optional(v.array(appliedEditValidator)),
    browserJob: v.optional(browserJobValidator),
    browserJobPatch: v.optional(browserJobPatchValidator),
    auditEvent: v.optional(v.string()),
    auditDetail: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (submission === null) throw new Error("Submission not found");

    if (args.expectStatus !== undefined && submission.status !== args.expectStatus) {
      return { applied: false as const };
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.status !== undefined) patch.status = args.status;
    if (args.error !== undefined) {
      patch.error = args.error;
    } else if (
      args.status !== undefined &&
      ["preparing", "awaiting_review", "submitting", "done", "cancelled"].includes(args.status)
    ) {
      patch.error = undefined;
    }

    let files = submission.files;
    if (args.appendOutputs && args.appendOutputs.length > 0) {
      const byKey = new Map(files.outputs.map((f) => [f.key, f]));
      for (const f of args.appendOutputs) byKey.set(f.key, f);
      files = { ...files, outputs: [...byKey.values()] };
    }
    if (args.uploadCandidate !== undefined) {
      files = { ...files, uploadCandidate: args.uploadCandidate ?? undefined };
    }
    if (files !== submission.files) patch.files = files;

    if (args.edits !== undefined) patch.edits = args.edits;

    if (args.browserJob !== undefined) {
      patch.browserJob = args.browserJob;
    } else if (args.browserJobPatch !== undefined) {
      const current = submission.browserJob ?? { provider: "browser_use" as const, intent: "unknown" };
      patch.browserJob = { ...current, ...args.browserJobPatch, provider: "browser_use" as const };
    }

    await ctx.db.patch(args.submissionId, patch);
    if (args.auditEvent !== undefined) {
      await ctx.db.insert("auditLog", {
        submissionId: args.submissionId,
        event: args.auditEvent,
        detail: args.auditDetail,
        at: Date.now(),
      });
    }

    const nextStatus =
      typeof patch.status === "string" ? patch.status : submission.status;
    const threadId = submission.threadId;
    if (nextStatus !== submission.status && threadId) {
      const previousCounts = await readThreadActivityCounts(
        ctx,
        submission.userId,
        threadId,
      );
      const counts = previousCounts
        ? applyActivityTransition(
            previousCounts,
            submission.status as string,
            nextStatus as string,
          )
        : await recomputeThreadActivity(ctx, submission.userId, threadId);
      await upsertThreadActivity(ctx, submission.userId, threadId, counts);
    }
    return { applied: true as const };
  },
});

export const releaseSubmissionCharge = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission || submission.userId !== args.userId) {
      throw new Error("Submission not found");
    }
    return { released: false as const };
  },
});

export const reserveSubmissionCharge = internalMutation({
  args: { submissionId: v.id("submissions"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission || submission.userId !== args.userId) {
      throw new Error("Submission not found");
    }
    return { amount: 0 };
  },
});

export const getSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const submission = await getOwnedSubmission(ctx, args.submissionId, userId);
    if (submission === null) throw new Error("Submission not found");
    return submission;
  },
});

export const listSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await listOwnedSubmissions(ctx, userId);
  },
});

export const listAwaitingReviewThreadIds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const activities = await ctx.db
      .query("submissionThreadActivity")
      .withIndex("by_user_awaiting", (q) =>
        q.eq("userId", userId).eq("hasAwaitingReview", true),
      )
      .collect();
    return [...new Set(activities.map((activity) => activity.threadId))];
  },
});

export const getThreadActivity = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const activity = await ctx.db
      .query("submissionThreadActivity")
      .withIndex("by_user_thread", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();
    return {
      visibleCount: activity?.visibleCount ?? 0,
      awaitingCount: activity?.awaitingCount ?? 0,
      hasAwaitingReview: activity?.hasAwaitingReview ?? false,
    };
  },
});

export const listThreadSubmissions = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const page = await ctx.db
      .query("submissions")
      .withIndex("by_thread_user", (q) =>
        q.eq("threadId", args.threadId).eq("userId", userId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.filter((submission) => submission.status !== "cancelled"),
    };
  },
});

export const approveForUpload = action({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
      submissionId: args.submissionId,
      userId,
    });
    if (submission === null) throw new Error("Submission not found");
    if (!canApproveSubmission(submission.status)) {
      throw new Error(`Cannot approve: submission is ${submission.status}`);
    }
    const candidate = submission.files.uploadCandidate;
    if (!candidate) throw new Error("Cannot approve: no upload candidate is set");

    const applied = await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId,
      expectStatus: "awaiting_review",
      status: "submitting",
      auditEvent: "approved_by_user",
      auditDetail: { name: candidate.name, key: candidate.key },
    });
    if (!applied.applied) {
      throw new Error("Submission changed while approving. Please retry.");
    }

    try {
      await ctx.runAction(internal.browserUseJobs.startUploadJob, {
        submissionId: args.submissionId,
        expectedStatus: "submitting",
        expectedCandidateKey: candidate.key,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload could not be started";
      const current = await ctx.runQuery(internal.submissions.getSubmissionInternal, {
        submissionId: args.submissionId,
      });
      if (
        current &&
        shouldRevertApprovalClaim(current.status, current.browserJob)
      ) {
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: args.submissionId,
          expectStatus: "submitting",
          status: "awaiting_review",
          error: message,
          auditEvent: "approval_upload_start_failed",
          auditDetail: { message },
        });
      } else if (current?.status === "submitting") {
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: args.submissionId,
          expectStatus: "submitting",
          error: message,
          auditEvent: "approval_upload_start_failed",
          auditDetail: { message, runId: current.browserJob?.runId ?? null },
        });
      }
      throw new Error(`Approval recorded but upload could not be started: ${message}`);
    }
    return { ok: true as const };
  },
});

export const cancelForUser = action({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const submission = await ctx.runQuery(internal.submissions.getSubmissionByUserId, {
      submissionId: args.submissionId,
      userId,
    });
    if (submission === null) throw new Error("Submission not found");
    if (!canCancelSubmission(submission.status)) {
      throw new Error(`Cannot cancel: submission is ${submission.status}`);
    }

    const previousStatus = submission.status;
    const applied = await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId,
      expectStatus: previousStatus,
      status: "cancelled",
      auditEvent: "cancelled_by_user",
    });
    if (!applied.applied) {
      throw new Error("Submission changed while cancelling. Please retry.");
    }

    try {
      await ctx.runAction(internal.browserUseJobs.cancelSubmissionJob, {
        submissionId: args.submissionId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cancellation could not be completed";
      const current = await ctx.runQuery(internal.submissions.getSubmissionInternal, {
        submissionId: args.submissionId,
      });
      if (current && shouldRevertCancelClaim(current.status)) {
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: args.submissionId,
          expectStatus: "cancelled",
          status: previousStatus,
          error: message,
          auditEvent: "cancel_failed",
          auditDetail: { message },
        });
      }
      throw new Error(`Cancellation failed: ${message}`);
    }
    return { ok: true as const };
  },
});

export const getSubmissionByUserId = internalQuery({
  args: { submissionId: v.id("submissions"), userId: v.id("users") },
  handler: async (ctx, args) => {
    return await getOwnedSubmission(ctx, args.submissionId, args.userId);
  },
});

export const listSubmissionsByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await listOwnedSubmissions(ctx, args.userId);
  },
});

export const getSubmissionInternal = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.submissionId);
  },
});
