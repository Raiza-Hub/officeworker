import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_PORTAL_KEY = "diper";

// Public status for the UI — never exposes ciphertext or the password.
export const getStatus = query({
  args: { portalKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const portalKey = args.portalKey?.trim() || DEFAULT_PORTAL_KEY;
    const connection = await ctx.db
      .query("workspaceConnections")
      .withIndex("by_user_portal", (q) =>
        q.eq("userId", userId).eq("portalKey", portalKey),
      )
      .first();

    if (connection === null) return null;

    return {
      portalKey: connection.portalKey,
      portalUrl: connection.portalUrl,
      portalEmail: connection.portalEmail,
      status: connection.status,
      lastError: connection.lastError ?? null,
      lastErrorAt: connection.lastErrorAt ?? null,
    };
  },
});

export const disconnectConnection = mutation({
  args: { portalKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const portalKey = args.portalKey?.trim() || DEFAULT_PORTAL_KEY;
    const connection = await ctx.db
      .query("workspaceConnections")
      .withIndex("by_user_portal", (q) =>
        q.eq("userId", userId).eq("portalKey", portalKey),
      )
      .first();
    if (connection) await ctx.db.delete(connection._id);
    return { ok: true as const };
  },
});

export const insertConnection = internalMutation({
  args: {
    userId: v.id("users"),
    portalKey: v.string(),
    portalUrl: v.string(),
    portalEmail: v.string(),
    ciphertext: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceConnections")
      .withIndex("by_user_portal", (q) =>
        q.eq("userId", args.userId).eq("portalKey", args.portalKey),
      )
      .first();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        portalUrl: args.portalUrl,
        portalEmail: args.portalEmail,
        ciphertext: args.ciphertext,
        status: "connected",
        lastErrorAt: undefined,
        lastError: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("workspaceConnections", {
      ...args,
      status: "connected",
    });
  },
});

export const markConnectionError = internalMutation({
  args: {
    userId: v.id("users"),
    portalKey: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("workspaceConnections")
      .withIndex("by_user_portal", (q) =>
        q.eq("userId", args.userId).eq("portalKey", args.portalKey),
      )
      .first();
    if (connection === null) return;

    await ctx.db.patch(connection._id, {
      status: "error",
      lastErrorAt: Date.now(),
      lastError: args.error,
    });
  },
});

// Fetches the stored connection (with ciphertext) for decryption inside the
// node action in workspaceActions.ts. Internal use only.
export const getConnectionForDecrypt = internalQuery({
  args: {
    userId: v.id("users"),
    portalKey: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("workspaceConnections")
      .withIndex("by_user_portal", (q) =>
        q.eq("userId", args.userId).eq("portalKey", args.portalKey),
      )
      .first();

    if (connection === null) {
      throw new Error("No workspace connection found for this portal");
    }

    return {
      portalKey: connection.portalKey,
      portalUrl: connection.portalUrl,
      portalEmail: connection.portalEmail,
      ciphertext: connection.ciphertext,
    };
  },
});
