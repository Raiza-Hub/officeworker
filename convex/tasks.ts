import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    return await ctx.db
      .query("tasks")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
  },
});

export const add = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    await ctx.db.insert("tasks", { text, isCompleted: false, ownerId });
  },
});
