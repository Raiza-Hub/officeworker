import { v } from "convex/values";
import { agent } from "./agent";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export const cleanupStaleDraftThreads = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - DAY_MS;
    const page = await ctx.db
      .query("threadActivity")
      .withIndex("by_status_activity", (q) =>
        q.eq("status", "draft").lt("lastActivityAt", cutoff),
      )
      .paginate({ cursor: args.cursor ?? null, numItems: 50 });

    for (const row of page.page) {
      await agent.deleteThreadAsync(ctx, { threadId: row.threadId });
      await ctx.db.delete(row._id);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.cleanup.cleanupStaleDraftThreads, {
        cursor: page.continueCursor,
      });
    }
  },
});
