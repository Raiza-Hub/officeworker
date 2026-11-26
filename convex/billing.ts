import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { creditWalletKobo, readWalletBalances } from "./credits";
import { sortCandlesAscending, buildThreadBillingCandle } from "../lib/billing-chart";
import { koboToNaira, nairaToKobo } from "../lib/billing";
import { normalizeTopupPlan } from "../lib/invoice";

const DEFAULT_PLAN = "basic" as const;

export async function getOrCreateWallet(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
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
    balanceKobo: 0,
    reservedKobo: 0,
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
    const balances = readWalletBalances(wallet);
    return {
      plan: wallet?.plan ?? DEFAULT_PLAN,
      balanceKobo: balances.balanceKobo,
      reservedKobo: balances.reservedKobo,
      availableKobo: balances.availableKobo,
      balance: koboToNaira(balances.balanceKobo),
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

export const recentActivity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const [topups, charges] = await Promise.all([
      ctx.db
        .query("walletTransactions")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(20),
      ctx.db
        .query("usageEvents")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(20),
    ]);
    return [
      ...topups.map((row) => ({
        _id: row._id,
        kind: "credit" as const,
        amountKobo:
          row.kind === "topup" || row.kind === "adjustment"
            ? Math.max(0, Math.round(row.amount * 100))
            : 0,
        description: row.description,
        createdAt: row.createdAt,
      })),
      ...charges.map((row) => ({
        _id: row._id,
        kind: "usage" as const,
        amountKobo: -row.chargeKobo,
        description: `${row.operation} usage${row.providerRef ? ` · ${row.providerRef}` : ""}`,
        createdAt: row.createdAt,
      })),
    ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  },
});

export const threadBillingCandles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const activities = await ctx.db
      .query("threadActivity")
      .withIndex("by_user_activity", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("status"), "draft"))
      .order("desc")
      .take(500);

    const candles = await Promise.all(
      activities.map(async (activity) => {
        const [reservations, submissions] = await Promise.all([
          ctx.db
            .query("usageReservations")
            .withIndex("by_scope_status", (q) =>
              q.eq("scopeKey", `thread:${activity.threadId}`),
            )
            .collect(),
          ctx.db
            .query("submissions")
            .withIndex("by_thread", (q) => q.eq("threadId", activity.threadId))
            .collect(),
        ]);
        const browserReservations = await Promise.all(
          submissions.map(async (submission) => {
            const reservationId = submission.browserJob?.reservationId;
            if (!reservationId) return null;
            const reservation = await ctx.db.get(reservationId);
            return reservation?.userId === userId ? reservation : null;
          }),
        );
        for (const reservation of browserReservations) {
          if (reservation) reservations.push(reservation);
        }
        const uniqueReservations = Array.from(
          new Map(reservations.map((row) => [row._id, row])).values(),
        );
        const events = await Promise.all(
          uniqueReservations.map(async (reservation) => {
            const event = reservation.usageEventId
              ? await ctx.db.get(reservation.usageEventId)
              : null;
            return (
              event ??
              (await ctx.db
                .query("usageEvents")
                .withIndex("by_reservation", (q) =>
                  q.eq("reservationId", reservation._id),
                )
                .first())
            );
          }),
        );
        const usageEvents = events.filter(
          (event): event is Doc<"usageEvents"> => event !== null,
        );
        const positiveCharges = usageEvents
          .map((event) => event.chargeKobo)
          .filter((charge) => charge > 0);
        const candle = buildThreadBillingCandle({
          threadId: activity.threadId,
          title: activity.title ?? null,
          date: activity.lastActivityAt,
          totalHeldKobo: uniqueReservations.reduce(
            (sum, row) => sum + row.amountKobo,
            0,
          ),
          totalChargedKobo: usageEvents.reduce(
            (sum, row) => sum + row.chargeKobo,
            0,
          ),
          totalProviderCostKobo: usageEvents.reduce(
            (sum, row) => sum + row.actualKobo,
            0,
          ),
          underRecoveryKobo: usageEvents.reduce(
            (sum, row) => sum + row.underRecoveryKobo,
            0,
          ),
          lowestSingleChargeKobo:
            positiveCharges.length > 0 ? Math.min(...positiveCharges) : 0,
          actionCount: usageEvents.length,
          turnCount: usageEvents.filter((event) => event.operation === "chat")
            .length,
          browserUse: uniqueReservations.some(
            (row) => row.operation === "browser_use",
          ),
          spreadsheetCharge: uniqueReservations.some(
            (row) => row.operation === "custom_tool",
          ),
        });
        return candle;
      }),
    );
    return sortCandlesAscending(candles).map((candle) => ({
      ...candle,
      date: candle.date.getTime(),
    }));
  },
});

export const fxSource = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("billingConfigVersions")
      .withIndex("by_key_active", (q) => q.eq("key", "default").eq("active", true))
      .first();
    const rate = config?.activeFxRateId
      ? await ctx.db.get(config.activeFxRateId)
      : null;
    return rate
      ? { source: rate.source, usdToNgn: rate.usdToNgn, fetchedAt: rate.fetchedAt }
      : null;
  },
});

export const invoiceHistory = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("topupIntents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .filter((q) => q.neq(q.field("status"), "pending"))
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((intent) => ({
        _id: intent._id,
        reference: intent.reference,
        amount: intent.amount,
        date: intent.paidAt ?? intent.createdAt,
        plan: normalizeTopupPlan(intent.plan),
        status: intent.status === "paid" ? ("paid" as const) : ("failed" as const),
      })),
    };
  },
});

async function balanceForUser(
  ctx: { db: QueryCtx["db"] },
  userId: Id<"users">,
  requiredKobo?: number,
) {
  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const balances = readWalletBalances(wallet);
  const requiredAmount = requiredKobo ?? 1;
  return {
    plan: wallet?.plan ?? DEFAULT_PLAN,
    availableKobo: balances.availableKobo,
    balanceKobo: balances.balanceKobo,
    reservedKobo: balances.reservedKobo,
    requiredAmount,
    sufficient: balances.availableKobo >= requiredAmount,
  };
}

export const checkBalance = query({
  args: { requiredAmount: v.optional(v.number()) },
  returns: v.union(
    v.object({
      authenticated: v.literal(false),
      sufficient: v.literal(false),
    }),
    v.object({
      authenticated: v.literal(true),
      plan: v.string(),
      availableKobo: v.number(),
      balanceKobo: v.number(),
      reservedKobo: v.number(),
      requiredAmount: v.number(),
      sufficient: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      return { authenticated: false, sufficient: false } as const;
    return {
      authenticated: true,
      ...(await balanceForUser(ctx, userId, args.requiredAmount)),
    } as const;
  },
});

export const checkBalanceByUserId = internalQuery({
  args: { userId: v.id("users"), requiredAmount: v.optional(v.number()) },
  handler: async (ctx, args) =>
    await balanceForUser(ctx, args.userId, args.requiredAmount),
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
    if (
      !Number.isSafeInteger(args.amount) ||
      args.amount < 3000 ||
      args.amount > 1_000_000
    ) {
      throw new Error("Choose an amount from ₦3,000 to ₦1,000,000");
    }
    if (
      await ctx.db
        .query("topupIntents")
        .withIndex("by_reference", (q) => q.eq("reference", args.reference))
        .first()
    ) {
      throw new Error("Payment reference already exists");
    }
    const user = await ctx.db.get(userId);
    const email = typeof user?.email === "string" ? user.email : "";
    if (!email)
      throw new Error("Your account needs an email address before you can add credits");
    const wallet = await getOrCreateWallet(ctx, userId);
    const now = Date.now();
    await ctx.db.insert("topupIntents", {
      userId,
      reference: args.reference,
      amount: args.amount,
      plan: wallet.plan,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      paymentMethod: "Korapay",
    });
    return {
      reference: args.reference,
      amount: args.amount,
      email,
      name:
        typeof user?.name === "string" && user.name ? user.name : email,
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

    const credited = await creditWalletKobo(
      ctx,
      intent.userId,
      nairaToKobo(args.amount),
      args.reference,
      "Wallet top-up via Korapay",
      { paymentMethod: paidPatch.paymentMethod },
    );
    if (credited.applied) {
      await ctx.db.insert("walletTransactions", {
        userId: intent.userId,
        kind: "topup",
        amount: args.amount,
        reference: args.reference,
        description: "Wallet top-up via Korapay",
        createdAt: now,
      });
    }
    await ctx.db.patch(intent._id, paidPatch);
    return { applied: credited.applied };
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
    const credited = await creditWalletKobo(
      ctx,
      user._id,
      nairaToKobo(args.amount),
      reference,
      args.description ?? "Manual wallet credit",
      { manual: true },
    );
    if (credited.applied) {
      await ctx.db.insert("walletTransactions", {
        userId: user._id,
        kind: "topup",
        amount: args.amount,
        reference,
        description: args.description ?? "Manual wallet credit",
        createdAt: now,
      });
    }

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const plan = wallet?.plan ?? DEFAULT_PLAN;
    const existingIntent = await ctx.db
      .query("topupIntents")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first();
    if (!existingIntent) {
      await ctx.db.insert("topupIntents", {
        userId: user._id,
        reference,
        amount: args.amount,
        plan,
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
    }

    return {
      applied: credited.applied,
      userId: user._id,
      email: args.email,
      amount: args.amount,
      reference,
      balance: koboToNaira(credited.balanceKobo),
    };
  },
});
