import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

type SearchFilterBuilder = {
  search: (field: "name", term: string) => SearchFilterBuilder;
  eq: (field: "ownerId" | "kind" | "sizeBucket" | "status", value: string) => SearchFilterBuilder;
};

type IndexRangeBuilder = {
  eq: (field: "ownerId", value: string) => IndexRangeBuilder;
  gte: (field: "_creationTime", value: number) => IndexRangeBuilder;
};

function deriveKind(type: string, name: string) {
  const t = type.toLowerCase();
  if (t.includes("pdf")) return "pdf";
  if (t.includes("wordprocessingml") || t.includes("msword")) return "word";
  if (t.includes("spreadsheetml") || t.includes("ms-excel") || t.includes("csv")) return "sheet";
  if (t.includes("presentationml") || t.includes("ms-powerpoint")) return "slide";
  if (t.startsWith("image/")) return "image";
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "word";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "sheet";
  if (ext === "ppt" || ext === "pptx") return "slide";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "heic"].includes(ext)) return "image";
  return "other";
}

function deriveSizeBucket(size: number) {
  if (size < 1 * 1024 * 1024) return "small";
  if (size < 10 * 1024 * 1024) return "medium";
  return "large";
}

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
      kind: deriveKind(type, name),
      sizeBucket: deriveSizeBucket(size),
    });
  },
});

export const backfillDocumentFacets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").collect();
    let updated = 0;
    for (const doc of docs) {
      const kind = deriveKind(doc.type, doc.name);
      const sizeBucket = deriveSizeBucket(doc.size);
      if (doc.kind === kind && doc.sizeBucket === sizeBucket) continue;
      await ctx.db.patch(doc._id, { kind, sizeBucket });
      updated++;
    }
    return { updated };
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

export const setDocumentStorageKey = mutation({
  args: { id: v.id("documents"), storageKey: v.string() },
  handler: async (ctx, { id, storageKey }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    const document = await ctx.db.get(id);
    if (document === null) throw new Error("Document not found");
    if (document.ownerId !== ownerId) throw new Error("Not authorized");
    await ctx.db.patch(id, { storageKey });
  },
});

export const getOwnedIdByStorageKey = query({
  args: { storageKey: v.string() },
  handler: async (ctx, { storageKey }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) return null;
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .filter((q) => q.eq(q.field("storageKey"), storageKey))
      .take(1);
    return documents[0]?._id ?? null;
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
    kind: v.optional(v.string()),
    sizeBucket: v.optional(v.string()),
    status: v.optional(v.string()),
    createdAfter: v.optional(v.number()),
  },
  handler: async (ctx, { searchTerm, paginationOpts, kind, sizeBucket, status, createdAfter }) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("Not authenticated");
    const term = searchTerm.trim();

    if (term.length === 0) {
      const base = ctx.db.query("documents").withIndex("by_owner", (q) => {
        let r = (q as unknown as IndexRangeBuilder).eq("ownerId", ownerId);
        if (createdAfter !== undefined) r = r.gte("_creationTime", createdAfter);
        return r as unknown as ReturnType<typeof q.eq>;
      });
      const filtered = base.filter((q) => {
        const conds = [] as ReturnType<typeof q.eq>[];
        if (kind !== undefined) conds.push(q.eq(q.field("kind"), kind));
        if (sizeBucket !== undefined) conds.push(q.eq(q.field("sizeBucket"), sizeBucket));
        if (status !== undefined) conds.push(q.eq(q.field("status"), status));
        if (conds.length === 0) return true;
        if (conds.length === 1) return conds[0]!;
        return q.and(...conds);
      });
      return await filtered.order("desc").paginate(paginationOpts);
    }

    let q = ctx.db
      .query("documents")
      .withSearchIndex("search_name", (s) => {
        let b = (s as unknown as SearchFilterBuilder).search("name", term).eq("ownerId", ownerId);
        if (kind !== undefined) b = b.eq("kind", kind);
        if (sizeBucket !== undefined) b = b.eq("sizeBucket", sizeBucket);
        if (status !== undefined) b = b.eq("status", status);
        return b as unknown as ReturnType<typeof s.search>;
      });
    if (createdAfter !== undefined) {
      q = q.filter((f) => f.gte(f.field("_creationTime"), createdAfter));
    }
    return await q.paginate(paginationOpts);
  },
});
