"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { encryptSecret, decryptSecret } from "./encryption";

const DEFAULT_PORTAL_KEY = "diper";
const DEFAULT_PORTAL_URL = "https://diper.ogunstate.gov.ng";

export const upsertConnection = action({
  args: {
    portalKey: v.optional(v.string()),
    portalUrl: v.optional(v.string()),
    portalEmail: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const portalKey = args.portalKey?.trim() || DEFAULT_PORTAL_KEY;
    const portalUrl = args.portalUrl?.trim() || DEFAULT_PORTAL_URL;
    const portalEmail = args.portalEmail.trim().toLowerCase();
    if (!portalEmail || !portalEmail.includes("@")) {
      throw new Error("Enter a valid email address");
    }
    if (!args.password) {
      throw new Error("Enter your password");
    }

    const ciphertext = encryptSecret(args.password);

    await ctx.runMutation(internal.workspace.insertConnection, {
      userId,
      portalKey,
      portalUrl,
      portalEmail,
      ciphertext,
    });

    return { ok: true as const };
  },
});

// Internal use only (trigger.dev flows in Phase 4). Decrypts in memory;
// plaintext never leaves the action return value, is never logged.
export const getDecryptedCredentials = internalAction({
  args: {
    userId: v.id("users"),
    portalKey: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    portalKey: string;
    portalUrl: string;
    portalEmail: string;
    password: string;
  }> => {
    const portalKey = args.portalKey?.trim() || DEFAULT_PORTAL_KEY;
    const connection = await ctx.runQuery(
      internal.workspace.getConnectionForDecrypt,
      { userId: args.userId, portalKey },
    );

    return {
      portalKey: connection.portalKey,
      portalUrl: connection.portalUrl,
      portalEmail: connection.portalEmail,
      password: decryptSecret(connection.ciphertext),
    };
  },
});
