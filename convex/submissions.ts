import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { notifications } from "./notification_client";

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("preparing"),
  v.literal("awaiting_review"),
  v.literal("login_failed"),
  v.literal("submitting"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const createSubmissionDraft = internalMutation({
  args: {
    userId: v.id("users"),
    portalKey: v.string(),
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
      runIds: {},
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

// Idempotent worker-owned state transition. If `expectStatus` is provided the
// patch only applies when the current status matches, so duplicate callback
// deliveries (task retries) are safe.
export const updateSubmission = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    expectStatus: v.optional(v.string()),
    status: v.optional(statusValidator),
    error: v.optional(v.string()),
    runIdKind: v.optional(v.union(v.literal("login"), v.literal("submit"))),
    runId: v.optional(v.string()),
    templateKey: v.optional(v.string()),
    templateName: v.optional(v.string()),
    filledKey: v.optional(v.string()),
    filledName: v.optional(v.string()),
    clearRunId: v.optional(v.union(v.literal("login"), v.literal("submit"))),
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
      // Already transitioned (e.g. duplicate callback) — treat as no-op.
      return { applied: false as const };
    }
    const statusChanged =
      args.status !== undefined && args.status !== submission.status;
    if (submission.chargeStatus === "charged") {
      return { applied: false as const };
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const chargeAmount = submission.chargeAmount ?? 500;
    if (args.status === "done" && submission.chargeStatus !== "reserved") {
      throw new Error("Upload cannot be completed without reserved wallet funds");
    }

    if (
      args.status === "done" &&
      submission.chargeStatus === "reserved"
    ) {
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
      (args.status === "failed" || args.status === "login_failed" || args.status === "cancelled") &&
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
    if (args.error !== undefined) patch.error = args.error;
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
    if (args.runIdKind !== undefined && args.runId !== undefined) {
      patch.runIds = {
        ...submission.runIds,
        [args.runIdKind]: args.runId,
      };
    }
    if (args.clearRunId !== undefined) {
      patch.runIds = {
        ...submission.runIds,
        [args.clearRunId]: undefined,
      };
    }

    await ctx.db.patch(args.submissionId, patch);
    if (statusChanged) {
      const href = submission.threadId
        ? `/agent/${submission.threadId}`
        : "/activity";
      const source = { type: "submission", id: String(args.submissionId) };
      const dedupeKey =
        `submission:${args.submissionId}:${submission.status}:` +
        `${args.status}:${submission.updatedAt}`;
      const subject = `${submission.subject} ${submission.term} ${submission.academicYear}`;

      if (args.status === "awaiting_review") {
        await notifications.create(ctx, {
          targetId: submission.userId,
          kind: "review_ready",
          data: {
            title: "Ready for your review",
            body: `${subject} is ready. Review it before uploading.`,
            href,
          },
          source,
          dedupeKey,
        });
      } else if (args.status === "login_failed" || args.status === "failed") {
        await notifications.create(ctx, {
          targetId: submission.userId,
          kind: "action_required",
          data: {
            title:
              args.status === "login_failed"
                ? "Portal sign-in needed"
                : "Upload needs attention",
            body:
              args.status === "login_failed"
                ? `Reconnect to the portal to continue ${subject}.`
                : `${subject} could not be uploaded. Open the chat to see what happened.`,
            href,
          },
          source,
          dedupeKey,
        });
      } else if (args.status === "done") {
        await notifications.create(ctx, {
          targetId: submission.userId,
          kind: "submission_completed",
          data: {
            title: "Submission completed",
            body: `${subject} was uploaded successfully.`,
            href,
          },
          source,
          dedupeKey,
        });

        if (submission.chargeStatus === "reserved") {
          const wallet = await ctx.db
            .query("wallets")
            .withIndex("by_user", (q) => q.eq("userId", submission.userId))
            .first();
          const available = Math.max(
            0,
            (wallet?.balance ?? 0) - (wallet?.reserved ?? 0),
          );
          const nextUploadCost = wallet?.plan === "pro" ? 1000 : 500;
          if (available < nextUploadCost) {
            await notifications.create(ctx, {
              targetId: submission.userId,
              kind: "billing",
              data: {
                title: "Wallet balance is low",
                body: "Add credits before starting your next upload.",
                href: "/billing",
              },
              source: { type: "wallet", id: String(submission.userId) },
              dedupeKey: `wallet-low:${submission.userId}:${available}`,
            });
          }
        }
      }
    }
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
    const chargeAmount = submission.chargeAmount ?? (wallet?.plan === "pro" ? 1000 : 500);
    const available = Math.max(0, (wallet?.balance ?? 0) - (wallet?.reserved ?? 0));
    if (!wallet || available < chargeAmount) {
      throw new Error(
        `Insufficient wallet balance. This upload costs ₦${chargeAmount.toLocaleString()}; add credits to continue.`,
      );
    }
    await ctx.db.patch(wallet._id, {
      reserved: wallet.reserved + chargeAmount,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(submission._id, { chargeAmount, chargeStatus: "reserved" });
    return { amount: chargeAmount };
  },
});

export const replaceScoreMappings = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    mappings: v.array(
      v.object({
        studentName: v.string(),
        matchedName: v.optional(v.string()),
        matchConfidence: v.optional(v.number()),
        ca: v.optional(v.number()),
        exam: v.optional(v.number()),
        needsReview: v.boolean(),
        source: v.union(v.literal("ai"), v.literal("manual"), v.literal("edited")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scoreMappings")
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
      .collect();
    await Promise.all(
      existing.map((row) => ctx.db.delete(row._id)),
    );
    await Promise.all(
      args.mappings.map((mapping) =>
        ctx.db.insert("scoreMappings", {
          submissionId: args.submissionId,
          ...mapping,
        }),
      ),
    );
    return args.mappings.length;
  },
});

export const updateScoreMapping = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    studentName: v.string(),
    ca: v.optional(v.number()),
    exam: v.optional(v.number()),
    matchedName: v.optional(v.string()),
    needsReview: v.optional(v.boolean()),
    source: v.optional(
      v.union(v.literal("ai"), v.literal("manual"), v.literal("edited")),
    ),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("scoreMappings")
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
      .collect();
    const row = rows.find(
      (candidate) =>
        candidate.studentName.toLowerCase() === args.studentName.toLowerCase(),
    );
    if (row === undefined) throw new Error("Student not found in submission");

    const patch: Record<string, unknown> = {};
    if (args.ca !== undefined) patch.ca = args.ca;
    if (args.exam !== undefined) patch.exam = args.exam;
    if (args.matchedName !== undefined) patch.matchedName = args.matchedName;
    if (args.needsReview !== undefined) patch.needsReview = args.needsReview;
    patch.source = args.source ?? "edited";
    await ctx.db.patch(row._id, patch);

    await ctx.db.insert("auditLog", {
      submissionId: args.submissionId,
      event: "score_edited",
      detail: { ...args },
      at: Date.now(),
    });
    return row._id;
  },
});

export const getSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const submission = await ctx.db.get(args.submissionId);
    if (submission === null || submission.userId !== userId) {
      throw new Error("Submission not found");
    }
    const mappings = await ctx.db
      .query("scoreMappings")
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
      .collect();
    return {
      ...submission,
      mappings: mappings.map((row) => ({
        studentName: row.studentName,
        matchedName: row.matchedName ?? null,
        matchConfidence: row.matchConfidence ?? null,
        ca: row.ca ?? null,
        exam: row.exam ?? null,
        needsReview: row.needsReview,
        source: row.source,
      })),
    };
  },
});

export const listSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db
      .query("submissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

// Worker-facing read (via task callback endpoint): submission + mappings.
export const getSubmissionForTask = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (submission === null) return null;
    const mappings = await ctx.db
      .query("scoreMappings")
      .withIndex("by_submission", (q) => q.eq("submissionId", args.submissionId))
      .collect();
    return {
      _id: submission._id,
      userId: submission.userId,
      portalKey: submission.portalKey,
      threadId: submission.threadId,
      className: submission.className,
      subject: submission.subject,
      term: submission.term,
      academicYear: submission.academicYear,
      status: submission.status,
      files: submission.files,
      mappings: mappings.map((row) => ({
        studentName: row.studentName,
        matchedName: row.matchedName,
        matchConfidence: row.matchConfidence,
        ca: row.ca,
        exam: row.exam,
        needsReview: row.needsReview,
        source: row.source,
      })),
    };
  },
});
