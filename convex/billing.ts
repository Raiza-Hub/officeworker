import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query, mutation } from "./_generated/server";

const DEFAULT_PLAN = "basic" as const;

async function getOrCreateWallet(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("wallets", {
    userId,
    plan: DEFAULT_PLAN,
    balance: 0,
    reserved: 0,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to initialize wallet");
  return created;
}

export const currentWallet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const plan = wallet?.plan ?? DEFAULT_PLAN;
    return {
      plan,
      pricePerUpload: plan === "pro" ? 1000 : 500,
      balance: wallet?.balance ?? 0,
      reserved: wallet?.reserved ?? 0,
      available: Math.max(0, (wallet?.balance ?? 0) - (wallet?.reserved ?? 0)),
    };
  },
});

export const recentTransactions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("walletTransactions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const checkBalance = query({
  args: { requiredAmount: v.optional(v.number()) },
  // Discriminated union so callers narrow with `if (!balance.authenticated)`
  // and get non-optional plan/available/requiredAmount afterwards.
  returns: v.union(
    v.object({
      authenticated: v.literal(false),
      sufficient: v.literal(false),
    }),
    v.object({
      authenticated: v.literal(true),
      plan: v.string(),
      available: v.number(),
      requiredAmount: v.number(),
      sufficient: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      return { authenticated: false, sufficient: false } as const;
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const plan = wallet?.plan ?? DEFAULT_PLAN;
    const requiredAmount = args.requiredAmount ?? (plan === "pro" ? 1000 : 500);
    const available = Math.max(0, (wallet?.balance ?? 0) - (wallet?.reserved ?? 0));
    return {
      authenticated: true,
      plan,
      available,
      requiredAmount,
      sufficient: available >= requiredAmount,
    } as const;
  },
});

export const setPlan = mutation({
  args: { plan: v.union(v.literal("basic"), v.literal("pro")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const wallet = await getOrCreateWallet(ctx, userId);
    await ctx.db.patch(wallet._id, { plan: args.plan, updatedAt: Date.now() });
    return { plan: args.plan };
  },
});

export const createTopupIntent = mutation({
  args: { reference: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!Number.isSafeInteger(args.amount) || args.amount < 500 || args.amount > 1_000_000) {
      throw new Error("Choose an amount from ₦500 to ₦1,000,000");
    }
    if (await ctx.db.query("topupIntents").withIndex("by_reference", (q) => q.eq("reference", args.reference)).first()) {
      throw new Error("Payment reference already exists");
    }
    const user = await ctx.db.get(userId);
    const email = typeof user?.email === "string" ? user.email : "";
    if (!email) throw new Error("Your account needs an email address before you can add credits");
    await getOrCreateWallet(ctx, userId);
    await ctx.db.insert("topupIntents", {
      userId,
      reference: args.reference,
      amount: args.amount,
      status: "pending",
      createdAt: Date.now(),
    });
    return {
      reference: args.reference,
      amount: args.amount,
      email,
      name: typeof user?.name === "string" && user.name ? user.name : email,
    };
  },
});

export const failTopupIntent = mutation({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const intent = await ctx.db
      .query("topupIntents")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();
    if (!intent || intent.userId !== userId || intent.status !== "pending") return;
    await ctx.db.patch(intent._id, { status: "failed" });
  },
});

export const applyTopup = internalMutation({
  args: {
    reference: v.string(),
    amount: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.currency !== "NGN" || !Number.isFinite(args.amount)) {
      throw new Error("Invalid payment currency or amount");
    }
    const intent = await ctx.db
      .query("topupIntents")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();
    if (!intent) throw new Error("Payment intent not found");
    if (intent.status === "paid") return { applied: false };
    if (intent.status !== "pending" || intent.amount !== args.amount) {
      throw new Error("Payment does not match the pending top-up");
    }
    const existing = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();
    if (existing) {
      await ctx.db.patch(intent._id, { status: "paid" });
      return { applied: false };
    }
    const wallet = await getOrCreateWallet(ctx, intent.userId);
    await ctx.db.patch(wallet._id, {
      balance: wallet.balance + args.amount,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("walletTransactions", {
      userId: intent.userId,
      kind: "topup",
      amount: args.amount,
      reference: args.reference,
      description: "Wallet top-up via Korapay",
      createdAt: Date.now(),
    });
    await ctx.db.patch(intent._id, { status: "paid" });
    return { applied: true };
  },
});
