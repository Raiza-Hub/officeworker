import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const createDocument = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    size: v.number(),
    storageKey: v.string(),
  },
  handler: async (ctx, { name, type, size, storageKey }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    return await ctx.db.insert("documents", {
      name,
      type,
      size,
      storageKey,
      status: "Uploading",
      ownerId,
    });
  },
});

export const setDocumentSuccess = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    const document = await ctx.db.get(id);
    if (document === null) throw new Error("Document not found");
    if (document.ownerId !== ownerId) throw new Error("Not authorized");
    await ctx.db.patch(id, { status: "Success" });
  },
});

export const deleteDocument = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    const document = await ctx.db.get(id);
    if (document === null) throw new Error("Document not found");
    if (document.ownerId !== ownerId) throw new Error("Not authorized");
    await ctx.db.delete(id);
  },
});

export const searchList = query({
  args: {
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { searchTerm, paginationOpts }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    const term = searchTerm.trim();
    if (term.length === 0) {
      return await ctx.db
        .query("documents")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .paginate(paginationOpts);
    }
    return await ctx.db
      .query("documents")
      .withSearchIndex("search_name", (q) =>
        q.search("name", term).eq("ownerId", ownerId),
      )
      .paginate(paginationOpts);
  },
});
