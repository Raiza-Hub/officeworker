import { getAuthUserId } from "@convex-dev/auth/server";
import { abortStream } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  BILLING_CONFIG,
  computeSettlement,
  koboToNaira,
  usdForKobo,
  type BillingOperation,
} from "../lib/billing";

type ActiveBilling = {
  config: Doc<"billingConfigVersions">;
  fxRate: Doc<"fxRates">;
};

const SETTLEMENT_MAX_ATTEMPTS = 5;

function now() {
  return Date.now();
}

export function readWalletBalances(wallet: Doc<"wallets"> | null) {
  const balanceKobo =
    wallet?.balanceKobo ?? Math.round((wallet?.balance ?? 0) * 100);
  const reservedKobo =
    wallet?.reservedKobo ?? Math.round((wallet?.reserved ?? 0) * 100);
  return {
    balanceKobo,
    reservedKobo,
    availableKobo: Math.max(0, balanceKobo - reservedKobo),
  };
}

async function getOrCreateWallet(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"wallets">> {
  const existing = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("wallets", {
    userId,
    plan: "basic",
    balance: 0,
    reserved: 0,
    balanceKobo: 0,
    reservedKobo: 0,
    updatedAt: now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to initialize wallet");
  return created;
}

export async function ensureActiveBillingCore(
  ctx: MutationCtx,
): Promise<ActiveBilling> {
  const active = await ctx.db
    .query("billingConfigVersions")
    .withIndex("by_key_active", (q) => q.eq("key", "default").eq("active", true))
    .first();
  if (active) {
    const fxRate = active.activeFxRateId
      ? await ctx.db.get(active.activeFxRateId)
      : null;
    if (fxRate?.active) return { config: active, fxRate };
  }

  const seedId = await ctx.db.insert("fxRates", {
    source: "seed",
    usdToNgn: BILLING_CONFIG.seedFx.usdToNgn,
    sourceDate: BILLING_CONFIG.seedFx.sourceDate,
    fetchedAt: now(),
    active: true,
  });
  const configId = await ctx.db.insert("billingConfigVersions", {
    key: "default",
    version: 1,
    active: true,
    markupPct: BILLING_CONFIG.markupPct,
    holdSafetyFactor: BILLING_CONFIG.holdSafetyFactor,
    browserUseMaxCostUsd: BILLING_CONFIG.browserUseMaxCostUsd,
    chatTurnCapKobo: BILLING_CONFIG.chatTurnCapKobo,
    titleCapKobo: BILLING_CONFIG.titleCapKobo,
    customToolCapKobo: BILLING_CONFIG.customToolCapKobo,
    pdfCapKobo: BILLING_CONFIG.pdfCapKobo,
    activeFxRateId: seedId,
    createdAt: now(),
    updatedAt: now(),
  });
  const [config, fxRate] = await Promise.all([
    ctx.db.get(configId),
    ctx.db.get(seedId),
  ]);
  if (!config || !fxRate) throw new Error("Failed to initialize billing config");
  if (active) await ctx.db.patch(active._id, { active: false, updatedAt: now() });
  return { config, fxRate };
}

async function getActiveBillingCore(
  ctx: QueryCtx | MutationCtx,
): Promise<ActiveBilling | null> {
  const config = await ctx.db
    .query("billingConfigVersions")
    .withIndex("by_key_active", (q) => q.eq("key", "default").eq("active", true))
    .first();
  if (!config?.activeFxRateId) return null;
  const fxRate = await ctx.db.get(config.activeFxRateId);
  if (!fxRate?.active) return null;
  return { config, fxRate };
}

export const getActiveFx = internalQuery({
  args: {},
  handler: async (ctx) => {
    const active = await getActiveBillingCore(ctx);
    if (!active) return null;
    return {
      fxRateId: active.fxRate._id,
      usdToNgn: active.fxRate.usdToNgn,
      markupPct: active.config.markupPct,
      source: active.fxRate.source,
    };
  },
});

export const getActiveBillingConfig = internalQuery({
  args: {},
  handler: async (ctx) => await getActiveBillingCore(ctx),
});

export const currentCreditSummary = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return readWalletBalances(wallet);
  },
});

export async function creditWalletKobo(
  ctx: MutationCtx,
  userId: Id<"users">,
  amountKobo: number,
  reference: string,
  description: string,
  metadata?: unknown,
): Promise<{ applied: boolean; balanceKobo: number }> {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw new Error("Credit amount must be positive kobo");
  }
  const existing = await ctx.db
    .query("creditLedger")
    .withIndex("by_reference", (q) => q.eq("reference", reference))
    .first();
  if (existing) return { applied: false, balanceKobo: existing.balanceAfterKobo };

  const wallet = await getOrCreateWallet(ctx, userId);
  const current = readWalletBalances(wallet);
  const balanceKobo = current.balanceKobo + amountKobo;
  await ctx.db.patch(wallet._id, {
    balanceKobo,
    reservedKobo: current.reservedKobo,
    balance: koboToNaira(balanceKobo),
    reserved: koboToNaira(current.reservedKobo),
    updatedAt: now(),
  });
  await ctx.db.insert("creditLedger", {
    userId,
    kind: "topup",
    amountKobo,
    balanceAfterKobo: balanceKobo,
    reservedAfterKobo: current.reservedKobo,
    reference,
    description,
    metadata,
    createdAt: now(),
  });
  return { applied: true, balanceKobo };
}

export type ReserveCreditsArgs = {
  userId: Id<"users">;
  key: string;
  operation: string;
  amountKobo: number;
  scopeKey?: string;
  metadata?: unknown;
};

export async function reserveCreditsCore(
  ctx: MutationCtx,
  args: ReserveCreditsArgs,
): Promise<Id<"usageReservations">> {
    const existing = await ctx.db
      .query("usageReservations")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) return existing._id;

    const { config, fxRate } = await ensureActiveBillingCore(ctx);
    if (
      !Number.isSafeInteger(args.amountKobo) ||
      args.amountKobo <= 0
    ) {
      throw new Error("Reservation amount must be positive kobo");
    }
    const wallet = await getOrCreateWallet(ctx, args.userId);
    const balances = readWalletBalances(wallet);
    if (balances.balanceKobo <= 0) {
      await ctx.scheduler.runAfter(0, internal.credits.cancelActiveWorkForUser, {
        userId: args.userId,
      });
      throw new ConvexError({
        code: "WALLET_EMPTY",
        context: "continue",
        message: "You’ve run out of credits. Add credits to continue this chat.",
      });
    }
    if (balances.availableKobo < args.amountKobo) {
      throw new ConvexError({
        code: "INSUFFICIENT_CREDITS",
        message:
          "You don’t have enough credits to complete this request. Add more credits to continue.",
        required: args.amountKobo,
        available: balances.availableKobo,
      });
    }

    const reservedKobo = balances.reservedKobo + args.amountKobo;
    const createdAt = now();
    const id = await ctx.db.insert("usageReservations", {
      userId: args.userId,
      key: args.key,
      operation: args.operation as BillingOperation,
      scopeKey: args.scopeKey,
      amountKobo: args.amountKobo,
      usdToNgn: fxRate.usdToNgn,
      markupPct: config.markupPct,
      fxRateId: fxRate._id,
      status: "active",
      metadata: args.metadata,
      expiresAt: createdAt + BILLING_CONFIG.staleHoldMs,
      createdAt,
      updatedAt: createdAt,
    });
    await ctx.db.patch(wallet._id, {
      balanceKobo: balances.balanceKobo,
      reservedKobo,
      balance: koboToNaira(balances.balanceKobo),
      reserved: koboToNaira(reservedKobo),
      updatedAt: createdAt,
    });
    await ctx.db.insert("creditLedger", {
      userId: args.userId,
      kind: "reservation",
      amountKobo: -args.amountKobo,
      balanceAfterKobo: balances.balanceKobo,
      reservedAfterKobo: reservedKobo,
      reference: `reservation:${id}`,
      description: `Credit hold for ${args.operation}`,
      reservationId: id,
      metadata: args.metadata,
      createdAt,
    });
  return id;
}

export const reserveCredits = internalMutation({
  args: {
    userId: v.id("users"),
    key: v.string(),
    operation: v.string(),
    amountKobo: v.number(),
    scopeKey: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => await reserveCreditsCore(ctx, args),
});

type ReserveCustomToolHoldArgs = {
  userId: Id<"users">;
  key: string;
  scopeKey?: string;
  metadata?: unknown;
  providerRef?: string;
};

type ReserveCustomToolHoldInput = Omit<ReserveCustomToolHoldArgs, "userId">;

export async function reserveCustomToolHoldsCore(
  ctx: MutationCtx,
  userId: Id<"users">,
  holds: readonly ReserveCustomToolHoldInput[],
): Promise<Id<"usageReservations">[]> {
  const uniqueHolds = [...new Map(holds.map((hold) => [hold.key, hold])).values()];
  if (uniqueHolds.length === 0) return [];

  const existingRows = await Promise.all(
    uniqueHolds.map(
      async (hold) =>
        await ctx.db
          .query("usageReservations")
          .withIndex("by_key", (q) => q.eq("key", hold.key))
          .first(),
    ),
  );
  const existingByKey = new Map(
    uniqueHolds.map((hold, index) => [hold.key, existingRows[index]]),
  );
  const newHolds = uniqueHolds.filter((hold) => !existingByKey.get(hold.key));
  if (newHolds.length === 0) {
    return uniqueHolds.map((hold) => existingByKey.get(hold.key)!._id);
  }

  const { config, fxRate } = await ensureActiveBillingCore(ctx);
  const amountKobo = BILLING_CONFIG.customToolCapKobo;
  const requiredKobo = amountKobo * newHolds.length;
  const wallet = await getOrCreateWallet(ctx, userId);
  const balances = readWalletBalances(wallet);
  if (balances.balanceKobo <= 0) {
    await ctx.scheduler.runAfter(0, internal.credits.cancelActiveWorkForUser, {
      userId,
    });
    throw new ConvexError({
      code: "WALLET_EMPTY",
      context: "continue",
      message: "You’ve run out of credits. Add credits to continue this chat.",
    });
  }
  if (balances.availableKobo < requiredKobo) {
    throw new ConvexError({
      code: "INSUFFICIENT_CREDITS",
      message:
        "You don’t have enough credits to complete this request. Add more credits to continue.",
      required: requiredKobo,
      available: balances.availableKobo,
    });
  }

  const createdAt = now();
  const reservedKobo = balances.reservedKobo + requiredKobo;
  const walletPatch = ctx.db.patch(wallet._id, {
    balanceKobo: balances.balanceKobo,
    reservedKobo,
    balance: koboToNaira(balances.balanceKobo),
    reserved: koboToNaira(reservedKobo),
    updatedAt: createdAt,
  });
  const newIds = await Promise.all(
    newHolds.map(async (hold) => {
      const id = await ctx.db.insert("usageReservations", {
        userId,
        key: hold.key,
        operation: "custom_tool",
        scopeKey: hold.scopeKey,
        amountKobo,
        usdToNgn: fxRate.usdToNgn,
        markupPct: config.markupPct,
        fxRateId: fxRate._id,
        status: "active",
        metadata: hold.metadata,
        providerRef: hold.providerRef,
        expiresAt: createdAt + BILLING_CONFIG.staleHoldMs,
        createdAt,
        updatedAt: createdAt,
      });
      await ctx.db.insert("creditLedger", {
        userId,
        kind: "reservation",
        amountKobo: -amountKobo,
        balanceAfterKobo: balances.balanceKobo,
        reservedAfterKobo: reservedKobo,
        reference: `reservation:${id}`,
        description: "Credit hold for custom_tool",
        reservationId: id,
        metadata: hold.metadata,
        createdAt,
      });
      return id;
    }),
  );
  await walletPatch;

  const newIdByKey = new Map(newHolds.map((hold, index) => [hold.key, newIds[index]!]));
  return uniqueHolds.map(
    (hold) => existingByKey.get(hold.key)?._id ?? newIdByKey.get(hold.key)!,
  );
}

export async function reserveCustomToolHoldCore(
  ctx: MutationCtx,
  args: ReserveCustomToolHoldArgs,
): Promise<Id<"usageReservations">> {
  const ids = await reserveCustomToolHoldsCore(ctx, args.userId, [args]);
  return ids[0]!;
}

export const reserveCustomToolHold = internalMutation({
  args: {
    userId: v.id("users"),
    key: v.string(),
    scopeKey: v.optional(v.string()),
    metadata: v.optional(v.any()),
    providerRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => await reserveCustomToolHoldCore(ctx, args),
});

export const reserveCustomToolHolds = internalMutation({
  args: {
    userId: v.id("users"),
    holds: v.array(
      v.object({
        key: v.string(),
        scopeKey: v.optional(v.string()),
        metadata: v.optional(v.any()),
        providerRef: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) =>
    await reserveCustomToolHoldsCore(ctx, args.userId, args.holds),
});

export const recordReservationProviderRef = internalMutation({
  args: {
    reservationId: v.id("usageReservations"),
    providerRef: v.string(),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) return;
    const currentMetadata =
      reservation.metadata &&
      typeof reservation.metadata === "object" &&
      !Array.isArray(reservation.metadata)
        ? (reservation.metadata as Record<string, unknown>)
        : {};
    await ctx.db.patch(args.reservationId, {
      providerRef: args.providerRef,
      metadata:
        args.order === undefined
          ? reservation.metadata
          : { ...currentMetadata, order: args.order },
      updatedAt: now(),
    });
  },
});

export const heartbeatReservation = internalMutation({
  args: { reservationId: v.id("usageReservations") },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== "active") return false;
    if (reservation.expiresAt - now() < BILLING_CONFIG.staleHoldMs / 2) {
      await ctx.db.patch(reservation._id, {
        expiresAt: now() + BILLING_CONFIG.staleHoldMs,
        updatedAt: now(),
      });
    }
    return true;
  },
});

export async function releaseReservationsCore(
  ctx: MutationCtx,
  reservationIds: readonly Id<"usageReservations">[],
  reason: string,
  nextStatus: "released" | "expired" | "cancelled" = "released",
): Promise<Id<"usageReservations">[]> {
  const uniqueIds = [...new Set(reservationIds)];
  if (uniqueIds.length === 0) return [];
  const rows = (
    await Promise.all(uniqueIds.map(async (id) => await ctx.db.get(id)))
  ).filter(
    (
      reservation,
    ): reservation is NonNullable<typeof reservation> =>
      reservation !== null && reservation.status === "active",
  );
  if (rows.length === 0) return [];
  const userIds = new Set(rows.map((reservation) => reservation.userId));
  if (userIds.size !== 1) {
    throw new Error("All reservations must belong to the same user");
  }

  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", rows[0]!.userId))
    .first();
  const balances = readWalletBalances(wallet);
  const releasedKobo = rows.reduce(
    (sum, reservation) => sum + reservation.amountKobo,
    0,
  );
  const reservedKobo = Math.max(0, balances.reservedKobo - releasedKobo);
  const timestamp = now();
  const writes: Promise<unknown>[] = [];
  if (wallet) {
    writes.push(
      ctx.db.patch(wallet._id, {
        reservedKobo,
        reserved: koboToNaira(reservedKobo),
        updatedAt: timestamp,
      }),
    );
  }
  for (const reservation of rows) {
    writes.push(
      ctx.db.patch(reservation._id, {
        status: nextStatus,
        updatedAt: timestamp,
      }),
      ctx.db.insert("creditLedger", {
        userId: reservation.userId,
        kind: "release",
        amountKobo: reservation.amountKobo,
        balanceAfterKobo: balances.balanceKobo,
        reservedAfterKobo: reservedKobo,
        reference: `release:${reservation._id}:${reason}`,
        description: `Released ${reservation.operation} hold`,
        reservationId: reservation._id,
        metadata: { reason },
        createdAt: timestamp,
      }),
    );
  }
  await Promise.all(writes);
  return rows.map((reservation) => reservation._id);
}

export async function releaseReservationCore(
  ctx: MutationCtx,
  reservationId: Id<"usageReservations">,
  reason: string,
  nextStatus: "released" | "expired" | "cancelled" = "released",
) {
  const released = await releaseReservationsCore(
    ctx,
    [reservationId],
    reason,
    nextStatus,
  );
  return released.length > 0;
}

export const releaseReservation = internalMutation({
  args: { reservationId: v.id("usageReservations"), reason: v.string() },
  handler: async (ctx, args) =>
    await releaseReservationCore(ctx, args.reservationId, args.reason),
});

export const releaseReservations = internalMutation({
  args: {
    reservationIds: v.array(v.id("usageReservations")),
    reason: v.string(),
  },
  handler: async (ctx, args) =>
    await releaseReservationsCore(ctx, args.reservationIds, args.reason),
});

export const expireStaleReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stale = await ctx.db
      .query("usageReservations")
      .withIndex("by_expires", (q) =>
        q.eq("status", "active").lt("expiresAt", now()),
      )
      .take(100);
    let expired = 0;
    for (const reservation of stale) {
      if (
        await releaseReservationCore(
          ctx,
          reservation._id,
          "stale_hold_expired",
          "expired",
        )
      ) {
        expired += 1;
      }
    }
    return { expired };
  },
});

export const enqueueSettlement = internalMutation({
  args: {
    reservationId: v.id("usageReservations"),
    userId: v.id("users"),
    providerCostUsd: v.number(),
    providerRef: v.optional(v.string()),
    usage: v.optional(v.any()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.providerCostUsd) || args.providerCostUsd < 0) {
      throw new Error("Provider cost must be a non-negative USD amount");
    }
    const existing = await ctx.db
      .query("settlementOutbox")
      .withIndex("by_idempotency", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey),
      )
      .first();
    const timestamp = now();
    if (existing) {
      if (existing.status !== "done") {
        await ctx.db.patch(existing._id, {
          providerCostUsd: args.providerCostUsd,
          providerRef: args.providerRef,
          usage: args.usage,
          status: "pending",
          attempts: 0,
          nextAttemptAt: timestamp,
          lastError: undefined,
          updatedAt: timestamp,
        });
      }
      return existing._id;
    }
    return await ctx.db.insert("settlementOutbox", {
      ...args,
      status: "pending",
      attempts: 0,
      nextAttemptAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

type SettleReservationCoreArgs = {
  ctx: MutationCtx;
  reservationId: Id<"usageReservations">;
  providerCostUsd: number;
  providerRef?: string;
  usage?: unknown;
  idempotencyKey: string;
  flatChargeKobo?: number;
};

export async function settleReservationCore(args: SettleReservationCoreArgs) {
  const { ctx, ...input } = args;
  const reservation = await ctx.db.get(input.reservationId);
  if (!reservation || reservation.status !== "active") {
    await markOutboxDone(ctx, input.idempotencyKey);
    return { chargedKobo: 0, applied: false };
  }
  const existingEvent = await ctx.db
    .query("usageEvents")
    .withIndex("by_idempotency", (q) =>
      q.eq("idempotencyKey", input.idempotencyKey),
    )
    .first();
  if (existingEvent) {
    await ctx.db.patch(reservation._id, {
      status: "settled",
      usageEventId: existingEvent._id,
      updatedAt: now(),
    });
    await markOutboxDone(ctx, input.idempotencyKey);
    return { chargedKobo: existingEvent.chargeKobo, applied: false };
  }

  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", reservation.userId))
    .first();
  const balances = readWalletBalances(wallet);
  const result = computeSettlement({
    holdKobo: reservation.amountKobo,
    capKobo: reservation.amountKobo,
    providerCostUsd: input.providerCostUsd,
    fx: {
      usdToNgn: reservation.usdToNgn,
      markupPct: reservation.markupPct,
    },
    balanceKobo: balances.balanceKobo,
    reservedKobo: balances.reservedKobo,
    flatChargeKobo: input.flatChargeKobo,
  });
  const timestamp = now();
  const usageEventId = await ctx.db.insert("usageEvents", {
    userId: reservation.userId,
    reservationId: reservation._id,
    operation: reservation.operation,
    providerCostUsd: input.providerCostUsd,
    usdToNgn: reservation.usdToNgn,
    markupPct: reservation.markupPct,
    actualKobo: result.actualKobo,
    chargeKobo: result.chargeKobo,
    underRecoveryKobo: result.underRecoveryKobo,
    providerRef: input.providerRef,
    usage: input.usage,
    idempotencyKey: input.idempotencyKey,
    fxRateId: reservation.fxRateId,
    createdAt: timestamp,
  });
  if (wallet) {
    await ctx.db.patch(wallet._id, {
      balanceKobo: result.newBalanceKobo,
      reservedKobo: result.newReservedKobo,
      balance: koboToNaira(result.newBalanceKobo),
      reserved: koboToNaira(result.newReservedKobo),
      updatedAt: timestamp,
    });
  }
  await ctx.db.insert("creditLedger", {
    userId: reservation.userId,
    kind: "charge",
    amountKobo: -result.chargeKobo,
    balanceAfterKobo: result.newBalanceKobo,
    reservedAfterKobo: result.newReservedKobo,
    reference: `charge:${usageEventId}`,
    description: `${reservation.operation} usage charge`,
    reservationId: reservation._id,
    usageEventId,
    metadata: {
      providerCostUsd: input.providerCostUsd,
      underRecoveryKobo: result.underRecoveryKobo,
    },
    createdAt: timestamp,
  });
  await ctx.db.patch(reservation._id, {
    status: "settled",
    usageEventId,
    providerRef: input.providerRef ?? reservation.providerRef,
    updatedAt: timestamp,
  });
  await markOutboxDone(ctx, input.idempotencyKey);
  if (result.newBalanceKobo <= 0) {
    await ctx.scheduler.runAfter(0, internal.credits.cancelActiveWorkForUser, {
      userId: reservation.userId,
    });
  }
  return { chargedKobo: result.chargeKobo, applied: true };
}

export const settleReservation = internalMutation({
  args: {
    reservationId: v.id("usageReservations"),
    providerCostUsd: v.number(),
    providerRef: v.optional(v.string()),
    usage: v.optional(v.any()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      return await settleReservationCore({ ctx, ...args });
    } catch (error) {
      const stopped = await markOutboxFailed(ctx, args.idempotencyKey, error);
      if (stopped) return { chargedKobo: 0, applied: false };
      throw error;
    }
  },
});

type CustomToolSettlementInput = {
  reservationId: Id<"usageReservations">;
  providerRef?: string;
  usage?: unknown;
  idempotencyKey: string;
};

type CustomToolSettlementResult = {
  reservationId: Id<"usageReservations">;
  chargedKobo: number;
  applied: boolean;
};

export async function settleCustomToolHoldsCore(
  ctx: MutationCtx,
  inputs: readonly CustomToolSettlementInput[],
): Promise<CustomToolSettlementResult[]> {
  const uniqueInputs = [
    ...new Map(inputs.map((input) => [input.reservationId, input])).values(),
  ];
  if (uniqueInputs.length === 0) return [];

  const reservations = await Promise.all(
    uniqueInputs.map(async (input) => await ctx.db.get(input.reservationId)),
  );
  const resultByKey = new Map<
    Id<"usageReservations">,
    CustomToolSettlementResult
  >();
  const validIndexes: number[] = [];
  for (let index = 0; index < uniqueInputs.length; index++) {
    const reservation = reservations[index];
    if (
      reservation?.operation === "custom_tool" &&
      reservation.status === "active"
    ) {
      validIndexes.push(index);
    } else {
      resultByKey.set(uniqueInputs[index]!.reservationId, {
        reservationId: uniqueInputs[index]!.reservationId,
        chargedKobo: 0,
        applied: false,
      });
    }
  }
  if (validIndexes.length === 0) {
    return uniqueInputs.map((input) => resultByKey.get(input.reservationId)!);
  }

  const validInputs = validIndexes.map((index) => uniqueInputs[index]!);
  const validReservations = validIndexes.map(
    (index) => reservations[index]!,
  );
  const userIds = new Set(validReservations.map((row) => row.userId));
  if (userIds.size !== 1) {
    throw new Error("All reservations must belong to the same user");
  }
  const userId = validReservations[0]!.userId;
  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const balances = readWalletBalances(wallet);
  const existingEvents = await Promise.all(
    validInputs.map(
      async (input) =>
        await ctx.db
          .query("usageEvents")
          .withIndex("by_idempotency", (q) =>
            q.eq("idempotencyKey", input.idempotencyKey),
          )
          .first(),
    ),
  );

  const timestamp = now();
  const writes: Promise<unknown>[] = [];
  const newPlans: Array<{
    input: CustomToolSettlementInput;
    reservation: NonNullable<(typeof reservations)[number]>;
    result: ReturnType<typeof computeSettlement>;
    fx: { usdToNgn: number; markupPct: number };
  }> = [];
  let runningBalanceKobo = balances.balanceKobo;
  let runningReservedKobo = balances.reservedKobo;

  for (let index = 0; index < validInputs.length; index++) {
    const input = validInputs[index]!;
    const reservation = validReservations[index]!;
    const existingEvent = existingEvents[index];
    if (existingEvent) {
      resultByKey.set(input.reservationId, {
        reservationId: input.reservationId,
        chargedKobo: existingEvent.chargeKobo,
        applied: false,
      });
      writes.push(
        ctx.db.patch(input.reservationId, {
          status: "settled",
          usageEventId: existingEvent._id,
          updatedAt: timestamp,
        }),
        markOutboxDone(ctx, input.idempotencyKey),
      );
      continue;
    }

    const fx = {
      usdToNgn: reservation.usdToNgn,
      markupPct: reservation.markupPct,
    };
    const result = computeSettlement({
      holdKobo: reservation.amountKobo,
      capKobo: reservation.amountKobo,
      providerCostUsd: usdForKobo(reservation.amountKobo, fx),
      fx,
      balanceKobo: runningBalanceKobo,
      reservedKobo: runningReservedKobo,
      flatChargeKobo: reservation.amountKobo,
    });
    runningBalanceKobo = result.newBalanceKobo;
    runningReservedKobo = result.newReservedKobo;
    resultByKey.set(input.reservationId, {
      reservationId: input.reservationId,
      chargedKobo: result.chargeKobo,
      applied: true,
    });
    newPlans.push({ input, reservation, result, fx });
  }

  if (newPlans.length > 0 && wallet) {
    writes.push(
      ctx.db.patch(wallet._id, {
        balanceKobo: runningBalanceKobo,
        reservedKobo: runningReservedKobo,
        balance: koboToNaira(runningBalanceKobo),
        reserved: koboToNaira(runningReservedKobo),
        updatedAt: timestamp,
      }),
    );
  }
  const newWrites = newPlans.map(async (plan) => {
    const usageEventId = await ctx.db.insert("usageEvents", {
      userId,
      reservationId: plan.reservation._id,
      operation: plan.reservation.operation,
      providerCostUsd: usdForKobo(plan.reservation.amountKobo, plan.fx),
      usdToNgn: plan.reservation.usdToNgn,
      markupPct: plan.reservation.markupPct,
      actualKobo: plan.result.actualKobo,
      chargeKobo: plan.result.chargeKobo,
      underRecoveryKobo: plan.result.underRecoveryKobo,
      providerRef: plan.input.providerRef,
      usage: plan.input.usage,
      idempotencyKey: plan.input.idempotencyKey,
      fxRateId: plan.reservation.fxRateId,
      createdAt: timestamp,
    });
    await ctx.db.insert("creditLedger", {
      userId,
      kind: "charge",
      amountKobo: -plan.result.chargeKobo,
      balanceAfterKobo: runningBalanceKobo,
      reservedAfterKobo: runningReservedKobo,
      reference: `charge:${usageEventId}`,
      description: `${plan.reservation.operation} usage charge`,
      reservationId: plan.reservation._id,
      usageEventId,
      metadata: {
        providerCostUsd: usdForKobo(plan.reservation.amountKobo, plan.fx),
        underRecoveryKobo: plan.result.underRecoveryKobo,
      },
      createdAt: timestamp,
    });
    await ctx.db.patch(plan.reservation._id, {
      status: "settled",
      usageEventId,
      providerRef:
        plan.input.providerRef ?? plan.reservation.providerRef ?? undefined,
      updatedAt: timestamp,
    });
    await markOutboxDone(ctx, plan.input.idempotencyKey);
  });
  await Promise.all([...writes, ...newWrites]);
  if (newPlans.length > 0 && runningBalanceKobo <= 0) {
    await ctx.scheduler.runAfter(0, internal.credits.cancelActiveWorkForUser, {
      userId,
    });
  }
  return uniqueInputs.map((input) => resultByKey.get(input.reservationId)!);
}

export const settleCustomToolHold = internalMutation({
  args: {
    reservationId: v.id("usageReservations"),
    providerRef: v.optional(v.string()),
    usage: v.optional(v.any()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const [result] = await settleCustomToolHoldsCore(ctx, [args]);
    return {
      chargedKobo: result?.chargedKobo ?? 0,
      applied: result?.applied ?? false,
    };
  },
});

export const settleCustomToolHolds = internalMutation({
  args: {
    holds: v.array(
      v.object({
        reservationId: v.id("usageReservations"),
        providerRef: v.optional(v.string()),
        usage: v.optional(v.any()),
        idempotencyKey: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) =>
    await settleCustomToolHoldsCore(ctx, args.holds),
});

async function markOutboxDone(ctx: MutationCtx, idempotencyKey: string) {
  const outbox = await ctx.db
    .query("settlementOutbox")
    .withIndex("by_idempotency", (q) =>
      q.eq("idempotencyKey", idempotencyKey),
    )
    .first();
  if (outbox) {
    await ctx.db.patch(outbox._id, {
      status: "done",
      updatedAt: now(),
    });
  }
}

async function markOutboxFailed(
  ctx: MutationCtx,
  idempotencyKey: string,
  error: unknown,
) {
  const outbox = await ctx.db
    .query("settlementOutbox")
    .withIndex("by_idempotency", (q) =>
      q.eq("idempotencyKey", idempotencyKey),
    )
    .first();
  if (!outbox || outbox.status === "done" || outbox.status === "failed") {
    return false;
  }
  const lastError = error instanceof Error ? error.message : String(error);
  if (outbox.attempts < SETTLEMENT_MAX_ATTEMPTS) {
    await ctx.db.patch(outbox._id, { lastError, updatedAt: now() });
    return false;
  }
  await ctx.db.patch(outbox._id, {
    status: "failed",
    lastError,
    updatedAt: now(),
  });
  return true;
}

export const processSettlementOutbox = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("settlementOutbox")
      .withIndex("by_status_next", (q) =>
        q.eq("status", "pending").lte("nextAttemptAt", now()),
      )
      .take(25);
    await Promise.all(
      pending.map(async (item) => {
        await ctx.db.patch(item._id, {
          attempts: item.attempts + 1,
          updatedAt: now(),
        });
        await ctx.scheduler.runAfter(0, internal.credits.settleReservation, {
          reservationId: item.reservationId,
          providerCostUsd: item.providerCostUsd,
          providerRef: item.providerRef,
          usage: item.usage,
          idempotencyKey: item.idempotencyKey,
        });
      }),
    );
    return { scheduled: pending.length };
  },
});

export const cancelActiveWorkForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ cancelled: number }> => {
    const active = await ctx.runQuery(internal.credits.listActiveReservations, {
      userId: args.userId,
    });
    await Promise.all(
      active.map(async (reservation) => {
        const metadata =
          reservation.metadata && typeof reservation.metadata === "object"
            ? (reservation.metadata as Record<string, unknown>)
            : {};
        if (reservation.operation === "browser_use" && reservation.providerRef) {
          try {
            await ctx.runAction(internal.browserUseJobs.cancelRunForBilling, {
              runId: reservation.providerRef,
            });
          } catch (error) {
            console.error("billing browser cancellation failed", error);
          }
        } else if (
          typeof metadata.threadId === "string" &&
          typeof metadata.order === "number"
        ) {
          try {
            await abortStream(ctx, components.agent, {
              threadId: metadata.threadId,
              order: metadata.order,
              reason: "Out of credits",
            });
          } catch (error) {
            console.error("billing stream cancellation failed", error);
          }
        }
        await ctx.runMutation(internal.credits.releaseReservation, {
          reservationId: reservation._id,
          reason: "balance_depleted",
        });
      }),
    );
    return { cancelled: active.length };
  },
});

export const getReservation = internalQuery({
  args: { reservationId: v.id("usageReservations") },
  handler: async (ctx, args) => await ctx.db.get(args.reservationId),
});

export const listActiveReservations = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("usageReservations")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active"),
      )
      .collect(),
});

export const walletForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return readWalletBalances(wallet);
  },
});

export const currentUserId = internalQuery({
  args: {},
  handler: async (ctx) => await getAuthUserId(ctx),
});
