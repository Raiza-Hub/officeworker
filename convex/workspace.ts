import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

function toStatus(connection: Doc<"workspaceConnections">) {
  return {
    adapterId: connection.adapterId,
    portalUrl: connection.portalUrl,
    portalEmail: connection.portalEmail,
    status: connection.status,
    browserUseProfileId: connection.browserUseProfileId ?? null,
    browserUseProfileStatus: connection.browserUseProfileStatus ?? null,
    lastError: connection.lastError ?? null,
    lastErrorAt: connection.lastErrorAt ?? null,
  };
}

async function getConnectionForUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("workspaceConnections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const connection = await getConnectionForUser(ctx, userId);
    return connection ? toStatus(connection) : null;
  },
});

export const getStatusByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const connection = await getConnectionForUser(ctx, args.userId);
    return connection ? toStatus(connection) : null;
  },
});

export const disconnectConnection = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const connection = await getConnectionForUser(ctx, userId);
    if (connection) await ctx.db.delete(connection._id);
    return { ok: true as const };
  },
});

export const insertConnection = internalMutation({
  args: {
    userId: v.id("users"),
    adapterId: v.string(),
    portalUrl: v.string(),
    portalEmail: v.string(),
    ciphertext: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await getConnectionForUser(ctx, args.userId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        adapterId: args.adapterId,
        portalUrl: args.portalUrl,
        portalEmail: args.portalEmail,
        ciphertext: args.ciphertext,
        status: "connected",
        lastErrorAt: undefined,
        lastError: undefined,
        // Keep existing Browser Use profile association when creds change unless cleared elsewhere.
      });
      return existing._id;
    }
    return await ctx.db.insert("workspaceConnections", {
      userId: args.userId,
      adapterId: args.adapterId,
      portalUrl: args.portalUrl,
      portalEmail: args.portalEmail,
      ciphertext: args.ciphertext,
      status: "connected",
      browserUseProfileStatus: "unknown",
    });
  },
});

export const setBrowserUseProfile = internalMutation({
  args: {
    userId: v.id("users"),
    browserUseProfileId: v.string(),
    browserUseProfileStatus: v.optional(
      v.union(v.literal("unknown"), v.literal("ready"), v.literal("needs_login")),
    ),
  },
  handler: async (ctx, args) => {
    const connection = await getConnectionForUser(ctx, args.userId);
    if (!connection) return;
    await ctx.db.patch(connection._id, {
      browserUseProfileId: args.browserUseProfileId,
      browserUseProfileStatus: args.browserUseProfileStatus ?? "unknown",
    });
  },
});

export const setBrowserUseProfileStatus = internalMutation({
  args: {
    userId: v.id("users"),
    browserUseProfileStatus: v.union(
      v.literal("unknown"),
      v.literal("ready"),
      v.literal("needs_login"),
    ),
  },
  handler: async (ctx, args) => {
    const connection = await getConnectionForUser(ctx, args.userId);
    if (!connection) return;
    await ctx.db.patch(connection._id, {
      browserUseProfileStatus: args.browserUseProfileStatus,
    });
  },
});

export const markConnectionError = internalMutation({
  args: { userId: v.id("users"), error: v.string() },
  handler: async (ctx, args) => {
    const connection = await getConnectionForUser(ctx, args.userId);
    if (!connection) return;
    await ctx.db.patch(connection._id, {
      status: "error",
      lastErrorAt: Date.now(),
      lastError: args.error,
    });
  },
});

export const getConnectionForDecrypt = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const connection = await getConnectionForUser(ctx, args.userId);
    if (!connection) throw new Error("No workspace connection found");
    return {
      adapterId: connection.adapterId,
      portalUrl: connection.portalUrl,
      portalEmail: connection.portalEmail,
      ciphertext: connection.ciphertext,
      browserUseProfileId: connection.browserUseProfileId ?? null,
      browserUseProfileStatus: connection.browserUseProfileStatus ?? null,
    };
  },
});

export const getConnectionInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await getConnectionForUser(ctx, args.userId);
  },
});
