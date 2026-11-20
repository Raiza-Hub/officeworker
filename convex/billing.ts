import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

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

export const recentInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const intents = await ctx.db
      .query("topupIntents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(40);
    return intents
      .filter((intent) => intent.status !== "pending")
      .slice(0, 20)
      .map((intent) => ({
        _id: intent._id,
        amount: intent.amount,
        createdAt: intent.createdAt,
        status: intent.status === "paid" ? ("Successful" as const) : ("Failed" as const),
        paymentMethod:
          intent.paymentMethod ??
          (intent.reference.startsWith("manual") ? "Manual" : "Korapay"),
      }));
  },
});

async function balanceForUser(
  ctx: { db: QueryCtx["db"] },
  userId: Id<"users">,
  requiredAmount?: number,
) {
  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const plan = (wallet?.plan ?? DEFAULT_PLAN) as "basic" | "pro";
  const amount = requiredAmount ?? (plan === "pro" ? 1000 : 500);
  const available = Math.max(0, (wallet?.balance ?? 0) - (wallet?.reserved ?? 0));
  return { plan, available, requiredAmount: amount, sufficient: available >= amount };
}

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
    return { authenticated: true, ...(await balanceForUser(ctx, userId, args.requiredAmount)) } as const;
  },
});

export const checkBalanceByUserId = internalQuery({
  args: { userId: v.id("users"), requiredAmount: v.optional(v.number()) },
  handler: async (ctx, args) => await balanceForUser(ctx, args.userId, args.requiredAmount),
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
    const now = Date.now();
    await ctx.db.insert("topupIntents", {
      userId,
      reference: args.reference,
      amount: args.amount,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      paymentMethod: "Korapay",
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
    await ctx.db.patch(intent._id, {
      status: "failed",
      updatedAt: Date.now(),
      paymentMethod: intent.paymentMethod ?? "Korapay",
      gatewayStatus: intent.gatewayStatus ?? "failed",
    });
  },
});

export const applyTopup = internalMutation({
  args: {
    reference: v.string(),
    amount: v.number(),
    currency: v.string(),
    paymentMethod: v.optional(v.string()),
    gatewayStatus: v.optional(v.string()),
    gatewayReference: v.optional(v.string()),
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

    const now = Date.now();
    const paidPatch = {
      status: "paid" as const,
      updatedAt: now,
      paidAt: intent.paidAt ?? now,
      paymentMethod: args.paymentMethod ?? intent.paymentMethod ?? "Korapay",
      gatewayStatus: args.gatewayStatus ?? intent.gatewayStatus ?? "success",
      gatewayReference: args.gatewayReference ?? intent.gatewayReference,
      currency: args.currency,
    };

    if (intent.status === "paid") {
      await ctx.db.patch(intent._id, paidPatch);
      return { applied: false };
    }
    if (intent.status !== "pending" || intent.amount !== args.amount) {
      throw new Error("Payment does not match the pending top-up");
    }
    const existing = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();
    if (existing) {
      await ctx.db.patch(intent._id, paidPatch);
      return { applied: false };
    }
    const wallet = await getOrCreateWallet(ctx, intent.userId);
    await ctx.db.patch(wallet._id, {
      balance: wallet.balance + args.amount,
      updatedAt: now,
    });
    await ctx.db.insert("walletTransactions", {
      userId: intent.userId,
      kind: "topup",
      amount: args.amount,
      reference: args.reference,
      description: "Wallet top-up via Korapay",
      createdAt: now,
    });
    await ctx.db.patch(intent._id, paidPatch);
    return { applied: true };
  },
});

export const markTopupFailed = internalMutation({
  args: {
    reference: v.string(),
    paymentMethod: v.optional(v.string()),
    gatewayStatus: v.optional(v.string()),
    gatewayReference: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const intent = await ctx.db
      .query("topupIntents")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .first();
    if (!intent || intent.status !== "pending") return { applied: false };
    await ctx.db.patch(intent._id, {
      status: "failed",
      updatedAt: Date.now(),
      paymentMethod: args.paymentMethod ?? intent.paymentMethod ?? "Korapay",
      gatewayStatus: args.gatewayStatus ?? "failed",
      gatewayReference: args.gatewayReference ?? intent.gatewayReference,
      currency: args.currency ?? intent.currency,
    });
    return { applied: true };
  },
});

export const adminCreditWallet = internalMutation({
  args: {
    email: v.string(),
    amount: v.number(),
    description: v.optional(v.string()),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new Error("Amount must be a positive number");
    }

    const user = (await ctx.db.query("users").collect()).find(
      (u) => "email" in u && u.email === args.email,
    );
    if (!user) throw new Error(`User not found: ${args.email}`);

    const now = Date.now();
    const reference = args.reference ?? `manual:credit:${user._id}:${now}`;

    const existingTx = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first();
    if (existingTx) {
      return {
        applied: false,
        reason: "reference_already_used" as const,
        reference,
        userId: user._id,
      };
    }

    const wallet = await getOrCreateWallet(ctx, user._id);
    await ctx.db.patch(wallet._id, {
      balance: wallet.balance + args.amount,
      updatedAt: now,
    });

    await ctx.db.insert("walletTransactions", {
      userId: user._id,
      kind: "topup",
      amount: args.amount,
      reference,
      description: args.description ?? "Manual wallet credit",
      createdAt: now,
    });

    const existingIntent = await ctx.db
      .query("topupIntents")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first();
    if (!existingIntent) {
    await ctx.db.insert("topupIntents", {
      userId: user._id,
      reference,
      amount: args.amount,
      status: "paid",
      createdAt: now,
      updatedAt: now,
      paidAt: now,
      paymentMethod: "Manual",
      gatewayStatus: "success",
    });
    } else if (existingIntent.status !== "paid") {
      await ctx.db.patch(existingIntent._id, {
        status: "paid",
        updatedAt: now,
        paidAt: existingIntent.paidAt ?? now,
        paymentMethod: existingIntent.paymentMethod ?? "Manual",
        gatewayStatus: "success",
      });
    } else {
      await ctx.db.patch(existingIntent._id, {
        paymentMethod: existingIntent.paymentMethod ?? "Manual",
        gatewayStatus: existingIntent.gatewayStatus ?? "success",
      });
    }

    return {
      applied: true,
      userId: user._id,
      email: args.email,
      amount: args.amount,
      reference,
      balance: wallet.balance + args.amount,
    };
  },
});
