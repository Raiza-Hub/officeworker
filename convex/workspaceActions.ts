"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { encryptSecret, decryptSecret } from "./encryption";
import { resolvePortalAdapter } from "./portalAdapter";

export const upsertConnection = action({
  args: {
    portalUrl: v.string(),
    portalEmail: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const portal = resolvePortalAdapter(args.portalUrl);
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
      adapterId: portal.adapterId,
      portalUrl: portal.portalUrl,
      portalEmail,
      ciphertext,
    });

    return { ok: true as const };
  },
});

// Internal use only. Decrypts in memory; plaintext never leaves the action
// return value and is never logged. Used by Browser Use job orchestration to
// supply per-run secret bindings (best-effort, no live HITL); values are not
// sent to the agent as task text.
export const getDecryptedCredentials = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    adapterId: string;
    portalUrl: string;
    portalEmail: string;
    password: string;
    browserUseProfileId: string | null;
  }> => {
    const connection = await ctx.runQuery(internal.workspace.getConnectionForDecrypt, {
      userId: args.userId,
    });
    return {
      adapterId: connection.adapterId,
      portalUrl: connection.portalUrl,
      portalEmail: connection.portalEmail,
      password: decryptSecret(connection.ciphertext),
      browserUseProfileId: connection.browserUseProfileId,
    };
  },
});
