import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("preparing"),
  v.literal("awaiting_scores"),
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
  // v4 events cursor (`nextAfter/after`) is an integer.
  lastEventCursor: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
  keepAliveUntil: v.optional(v.number()),
  attempts: v.optional(v.number()),
  lastError: v.optional(v.string()),
  resultSummary: v.optional(v.string()),
  syncDisabled: v.optional(v.boolean()),
});

const browserJobPatchValidator = v.object({
  intent: v.optional(v.string()),
  phase: v.optional(v.string()),
  status: v.optional(v.string()),
  runId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  workspaceId: v.optional(v.string()),
  profileId: v.optional(v.string()),
  // v4 events cursor (`nextAfter/after`) is an integer.
  lastEventCursor: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
  keepAliveUntil: v.optional(v.number()),
  attempts: v.optional(v.number()),
  lastError: v.optional(v.string()),
  resultSummary: v.optional(v.string()),
  syncDisabled: v.optional(v.boolean()),
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

export const createSubmissionDraft = internalMutation({
  args: {
    userId: v.id("users"),
    adapterId: v.string(),
    portalUrl: v.string(),
    threadId: v.optional(v.string()),
    className: v.string(),
    subject: v.string(),
    term: v.string(),
    academicYear: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const chargeAmount = wallet?.plan === "pro" ? 1000 : 500;
    const id = await ctx.db.insert("submissions", {
      ...args,
      chargeAmount,
      status: "preparing",
      browserJob: undefined,
      files: { uploads: [] },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      submissionId: id,
      event: "created",
      at: now,
    });
    return id;
  },
});

export const updateSubmission = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    expectStatus: v.optional(v.string()),
    status: v.optional(statusValidator),
    error: v.optional(v.string()),
    templateKey: v.optional(v.string()),
    templateName: v.optional(v.string()),
    filledKey: v.optional(v.string()),
    filledName: v.optional(v.string()),
    edits: v.optional(v.array(appliedEditValidator)),
    needsReview: v.optional(v.boolean()),
    browserJob: v.optional(browserJobValidator),
    browserJobPatch: v.optional(browserJobPatchValidator),
    auditEvent: v.optional(v.string()),
    auditDetail: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (submission === null) throw new Error("Submission not found");

    if (
      args.expectStatus !== undefined &&
      submission.status !== args.expectStatus
    ) {
      return { applied: false as const };
    }
    if (submission.chargeStatus === "charged") {
      return { applied: false as const };
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const chargeAmount = submission.chargeAmount ?? 500;
    if (args.status === "done" && submission.chargeStatus !== "reserved") {
      throw new Error("Upload cannot be completed without reserved wallet funds");
    }

    if (args.status === "done" && submission.chargeStatus === "reserved") {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", submission.userId))
        .first();
      if (!wallet || wallet.reserved < chargeAmount || wallet.balance < chargeAmount) {
        throw new Error("Reserved wallet funds are missing");
      }
      await ctx.db.patch(wallet._id, {
        balance: wallet.balance - chargeAmount,
        reserved: wallet.reserved - chargeAmount,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("walletTransactions", {
        userId: submission.userId,
        kind: "upload",
        amount: -chargeAmount,
        reference: `submission:${args.submissionId}`,
        description: `${submission.subject} ${submission.term} ${submission.academicYear} successful upload`,
        createdAt: Date.now(),
      });
      patch.chargeStatus = "charged";
    } else if (
      (args.status === "failed" ||
        args.status === "login_failed" ||
        args.status === "cancelled") &&
      submission.chargeStatus === "reserved"
    ) {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", submission.userId))
        .first();
      if (wallet) {
        await ctx.db.patch(wallet._id, {
          reserved: Math.max(0, wallet.reserved - chargeAmount),
          updatedAt: Date.now(),
        });
      }
      patch.chargeStatus = "released";
    }

    if (args.status !== undefined) patch.status = args.status;
    if (args.error !== undefined) {
      patch.error = args.error;
    } else if (
      args.status !== undefined &&
      ["draft", "preparing", "awaiting_scores", "awaiting_review", "submitting", "done", "cancelled"].includes(args.status)
    ) {
      patch.error = undefined;
    }

    if (args.templateKey !== undefined && args.templateName !== undefined) {
      patch.files = {
        ...submission.files,
        template: { key: args.templateKey, originalName: args.templateName },
      };
    }
    if (args.filledKey !== undefined && args.filledName !== undefined) {
      patch.files = {
        ...(patch.files ?? submission.files),
        filled: { key: args.filledKey, originalName: args.filledName },
      };
    }
    if (args.edits !== undefined) patch.edits = args.edits;
    if (args.needsReview !== undefined) patch.needsReview = args.needsReview;

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
    return { applied: true as const };
  },
});

export const reserveSubmissionCharge = internalMutation({
  args: { submissionId: v.id("submissions"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission || submission.userId !== args.userId) {
      throw new Error("Submission not found");
    }
    if (submission.status !== "awaiting_review") {
      throw new Error(`Cannot reserve funds while submission is ${submission.status}`);
    }
    if (submission.chargeStatus === "reserved") {
      return { amount: submission.chargeAmount ?? 500 };
    }
    if (submission.chargeStatus === "charged") {
      throw new Error("This submission has already been charged");
    }
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const plan = wallet?.plan ?? "basic";
    const chargeAmount = submission.chargeAmount ?? (plan === "pro" ? 1000 : 500);
    const available = Math.max(0, (wallet?.balance ?? 0) - (wallet?.reserved ?? 0));
    if (!wallet || available <= 0) {
      throw new ConvexError({
        code: "WALLET_EMPTY",
        context: "continue",
        message: "You’ve run out of credits. Add credits to continue this chat.",
      });
    }
    if (available < chargeAmount) {
      throw new ConvexError({
        code: "INSUFFICIENT_CREDITS",
        message:
          "You don’t have enough credits to complete this request. Add more credits to continue.",
        required: chargeAmount,
        available,
        plan,
      });
    }
    await ctx.db.patch(wallet._id, {
      reserved: wallet.reserved + chargeAmount,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(submission._id, {
      chargeAmount,
      chargeStatus: "reserved",
      needsReview: false,
    });
    return { amount: chargeAmount };
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
