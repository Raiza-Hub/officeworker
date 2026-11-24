import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { normalizeTopupPlan } from "../lib/invoice";

export const create = mutation({
  args: { intentId: v.id("topupIntents") },
  handler: async (ctx, { intentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const intent = await ctx.db.get(intentId);
    if (!intent || intent.userId !== userId) {
      throw new Error("Payment not found");
    }
    if (intent.status === "pending") {
      throw new Error("Payment is still pending");
    }
    const now = Date.now();
    const reportId = await ctx.db.insert("paymentReports", {
      userId,
      intentId,
      reference: intent.reference,
      amount: intent.amount,
      plan: normalizeTopupPlan(intent.plan),
      paymentStatus: intent.status,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    return { reportId, reference: intent.reference };
  },
});

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    return await ctx.db
      .query("paymentReports")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

export const listByIntent = internalQuery({
  args: { intentId: v.id("topupIntents") },
  handler: async (ctx, { intentId }) =>
    await ctx.db
      .query("paymentReports")
      .withIndex("by_intent", (q) => q.eq("intentId", intentId))
      .order("desc")
      .collect(),
});

export const listRecent = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("open"), v.literal("resolved"))),
  },
  handler: async (ctx, { paginationOpts, status }) => {
    const base =
      status === undefined
        ? ctx.db.query("paymentReports").order("desc")
        : ctx.db
            .query("paymentReports")
            .withIndex("by_status_created", (q) => q.eq("status", status))
            .order("desc");
    return await base.paginate(paginationOpts);
  },
});

export const setStatus = internalMutation({
  args: {
    reportId: v.id("paymentReports"),
    status: v.union(v.literal("open"), v.literal("resolved")),
  },
  handler: async (ctx, { reportId, status }) => {
    const report = await ctx.db.get(reportId);
    if (!report) throw new Error("Report not found");
    const updatedAt = Date.now();
    await ctx.db.patch(reportId, { status, updatedAt });
    return { ...report, status, updatedAt };
  },
});
