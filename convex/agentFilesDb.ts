import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";

export type FileOwner =
  | { kind: "document" }
  | { kind: "submission"; submissionId: string }
  | null;

// Resolves who owns an R2 key. Documents are registered in the `documents`
// table; submission files live under submissions/<id>/... and are owned via
// the submission's userId.
export const resolveFileOwnership = internalQuery({
  args: { key: v.string(), userId: v.id("users") },
  handler: async (ctx, args): Promise<FileOwner> => {
    if (args.key.includes("..")) return null;
    if (args.key.startsWith("documents/")) {
      const rows = await ctx.db
        .query("documents")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .filter((q) => q.eq(q.field("storageKey"), args.key))
        .take(1);
      return rows.length > 0 ? { kind: "document" } : null;
    }
    if (args.key.startsWith("submissions/")) {
      const submissionId = args.key.split("/")[1] as Id<"submissions">;
      const submission = await ctx.db.get(submissionId);
      if (submission === null || submission.userId !== args.userId) return null;
      return { kind: "submission", submissionId: submission._id };
    }
    return null;
  },
});

export const getSubmissionState = internalQuery({
  args: { submissionId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId as Id<"submissions">);
    if (submission === null || submission.userId !== args.userId) return null;
    return {
      status: submission.status,
      files: submission.files,
      browserJob: submission.browserJob ?? null,
    };
  },
});

export const registerEditedDocument = internalMutation({
  args: {
    userId: v.id("users"),
    storageKey: v.string(),
    originalKey: v.string(),
    name: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const original = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .filter((q) => q.eq(q.field("storageKey"), args.originalKey))
      .take(1);
    const ext = args.name.split(".").pop()?.toLowerCase() ?? "";
    const guessed = ext ? `${ext} file` : "file";
    await ctx.db.insert("documents", {
      name: args.name,
      type: original[0]?.type ?? guessed,
      size: args.size,
      storageKey: args.storageKey,
      status: "Success",
      ownerId: args.userId,
    });
  },
});
