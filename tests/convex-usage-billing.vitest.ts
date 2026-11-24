import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { BILLING_CONFIG } from "../lib/billing";

const modules = import.meta.glob("../convex/**/*.ts");

type Test = TestConvex<typeof schema>;

async function seedUser(t: Test) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
      emailVerificationTime: Date.now(),
    }),
  );
}

async function seedWallet(
  t: Test,
  userId: Awaited<ReturnType<typeof seedUser>>,
  balanceKobo: number,
  plan: "basic" | "pro" = "basic",
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("wallets", {
      userId,
      plan,
      balance: balanceKobo / 100,
      reserved: 0,
      balanceKobo,
      reservedKobo: 0,
      updatedAt: Date.now(),
    });
  });
}

describe("usage billing convex seams", () => {
  test("custom tool hold settles at the configured cap and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);
    const reservationId = await t.mutation(internal.credits.reserveCustomToolHold, {
      userId,
      key: "custom-tool:spreadsheet:message-1:file-1",
      scopeKey: "thread:thread-1",
      metadata: { toolName: "spreadsheet_parse" },
    });

    const settled = await t.mutation(internal.credits.settleCustomToolHold, {
      reservationId,
      providerRef: "message-1",
      idempotencyKey: "custom_tool:spreadsheet:message-1:file-1",
    });
    expect(settled).toEqual({ chargedKobo: BILLING_CONFIG.customToolCapKobo, applied: true });

    const wallet = await t.run(async (ctx) =>
      await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(wallet?.balanceKobo).toBe(10_000 - BILLING_CONFIG.customToolCapKobo);
    expect(wallet?.reservedKobo).toBe(0);

    const events = await t.run(async (ctx) =>
      await ctx.db
        .query("usageEvents")
        .withIndex("by_reservation", (q) => q.eq("reservationId", reservationId))
        .collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.operation).toBe("custom_tool");
    expect(events[0]?.chargeKobo).toBe(BILLING_CONFIG.customToolCapKobo);
  });

  test("custom tool hold release returns the reserved amount", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);
    const reservationId = await t.mutation(internal.credits.reserveCustomToolHold, {
      userId,
      key: "custom-tool:spreadsheet:message-2:file-2",
    });

    const released = await t.mutation(internal.credits.releaseReservation, {
      reservationId,
      reason: "cancelled_before_start",
    });
    expect(released).toBe(true);

    const wallet = await t.run(async (ctx) =>
      await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(wallet?.balanceKobo).toBe(10_000);
    expect(wallet?.reservedKobo).toBe(0);
  });

  test("chat stream order is saved on the reservation", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);
    const reservationId = await t.mutation(internal.credits.reserveCredits, {
      userId,
      key: "chat:stream-order",
      operation: "chat",
      amountKobo: 1_000,
      metadata: { threadId: "thread-1" },
    });

    await t.mutation(internal.credits.recordReservationProviderRef, {
      reservationId,
      providerRef: "message-1",
      order: 42,
    });

    const reservation = await t.run(async (ctx) => await ctx.db.get(reservationId));
    expect(reservation?.providerRef).toBe("message-1");
    expect(reservation?.metadata).toMatchObject({
      threadId: "thread-1",
      order: 42,
    });
  });

  test("settlement outbox closes when the reservation is already inactive", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);
    const reservationId = await t.mutation(internal.credits.reserveCredits, {
      userId,
      key: "chat:outbox-inactive",
      operation: "chat",
      amountKobo: 1_000,
    });
    await t.mutation(internal.credits.releaseReservation, {
      reservationId,
      reason: "cancelled_before_start",
    });
    const outboxId = await t.mutation(internal.credits.enqueueSettlement, {
      reservationId,
      userId,
      providerCostUsd: 0.1,
      idempotencyKey: "chat:outbox-inactive",
    });

    await t.mutation(internal.credits.settleReservation, {
      reservationId,
      providerCostUsd: 0.1,
      idempotencyKey: "chat:outbox-inactive",
    });

    const outbox = await t.run(async (ctx) => await ctx.db.get(outboxId));
    expect(outbox?.status).toBe("done");

    const events = await t.run(async (ctx) =>
      await ctx.db
        .query("usageEvents")
        .withIndex("by_reservation", (q) => q.eq("reservationId", reservationId))
        .collect(),
    );
    expect(events).toHaveLength(0);
  });

  test("thread candles aggregate chat, custom tool, and browser use", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);
    const now = Date.now();

    const chatReservationId = await t.mutation(internal.credits.reserveCredits, {
      userId,
      key: "chat:message-1",
      operation: "chat",
      amountKobo: 1_000,
      scopeKey: "thread:thread-1",
    });
    const customReservationId = await t.mutation(internal.credits.reserveCustomToolHold, {
      userId,
      key: "custom-tool:spreadsheet:message-1:file-1",
      scopeKey: "thread:thread-1",
    });
    const browserReservationId = await t.mutation(internal.credits.reserveCredits, {
      userId,
      key: "browser:job-1",
      operation: "browser_use",
      amountKobo: 400,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("threadActivity", {
        userId,
        threadId: "thread-1",
        title: "Test thread",
        lastActivityAt: now,
      });

      const rows = [
        {
          reservationId: chatReservationId,
          operation: "chat" as const,
          actualKobo: 1_000,
          chargeKobo: 800,
          underRecoveryKobo: 200,
          idempotencyKey: "chat:message-1",
        },
        {
          reservationId: customReservationId,
          operation: "custom_tool" as const,
          actualKobo: 2_000,
          chargeKobo: 2_000,
          underRecoveryKobo: 0,
          idempotencyKey: "custom_tool:message-1:file-1",
        },
        {
          reservationId: browserReservationId,
          operation: "browser_use" as const,
          actualKobo: 400,
          chargeKobo: 400,
          underRecoveryKobo: 0,
          idempotencyKey: "browser:job-1",
        },
      ];

      for (const row of rows) {
        const reservation = await ctx.db.get(row.reservationId);
        if (!reservation) throw new Error("Missing reservation");
        const eventId = await ctx.db.insert("usageEvents", {
          userId,
          reservationId: row.reservationId,
          operation: row.operation,
          providerCostUsd: 0,
          usdToNgn: reservation.usdToNgn,
          markupPct: reservation.markupPct,
          actualKobo: row.actualKobo,
          chargeKobo: row.chargeKobo,
          underRecoveryKobo: row.underRecoveryKobo,
          idempotencyKey: row.idempotencyKey,
          fxRateId: reservation.fxRateId,
          createdAt: now,
        });
        await ctx.db.patch(row.reservationId, {
          status: "settled",
          usageEventId: eventId,
          updatedAt: now,
        });
      }

      await ctx.db.insert("submissions", {
        userId,
        adapterId: "test",
        portalUrl: "https://example.com",
        threadId: "thread-1",
        goal: "Test browser use",
        status: "done",
        browserJob: {
          provider: "browser_use",
          intent: "Test browser use",
          reservationId: browserReservationId,
        },
        files: { inputs: [], outputs: [] },
        createdAt: now,
        updatedAt: now,
      });
    });

    const candles = await t
      .withIdentity({ subject: userId })
      .query(api.billing.threadBillingCandles, {});

    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({
      threadId: "thread-1",
      title: "Test thread",
      heldKobo: 3_400,
      chargedKobo: 3_200,
      providerCostKobo: 3_400,
      lowestSingleChargeKobo: 400,
      underRecoveryKobo: 200,
      actionCount: 3,
      turnCount: 1,
      browserUse: true,
      spreadsheetCharge: true,
    });
  });

  test("batch custom tool reservation dedupes keys and reserves the total", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);

    const ids = await t.mutation(internal.credits.reserveCustomToolHolds, {
      userId,
      holds: [
        { key: "file-1", scopeKey: "thread:thread-1", providerRef: "message-1" },
        { key: "file-2", scopeKey: "thread:thread-1", providerRef: "message-1" },
        { key: "file-1", scopeKey: "thread:thread-1", providerRef: "message-1" },
      ],
    });

    expect(ids).toHaveLength(2);
    const wallet = await t.run(async (ctx) =>
      await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(wallet?.reservedKobo).toBe(BILLING_CONFIG.customToolCapKobo * 2);
    const reservations = await t.run(async (ctx) =>
      await ctx.db
        .query("usageReservations")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "active"),
        )
        .collect(),
    );
    expect(reservations).toHaveLength(2);
    expect(
      reservations.every(
        (row) =>
          row.operation === "custom_tool" && row.providerRef === "message-1",
      ),
    ).toBe(true);
  });

  test("batch custom tool reservation rejects when the total exceeds available credits", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, BILLING_CONFIG.customToolCapKobo * 2 - 1);

    await expect(
      t.mutation(internal.credits.reserveCustomToolHolds, {
        userId,
        holds: [
          { key: "file-1", scopeKey: "thread:thread-1" },
          { key: "file-2", scopeKey: "thread:thread-1" },
        ],
      }),
    ).rejects.toThrow();
  });

  test("batch release and settle update the wallet once for multiple holds", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);

    const releasedIds = await t.mutation(internal.credits.reserveCustomToolHolds, {
      userId,
      holds: [
        { key: "release-1", scopeKey: "thread:thread-1" },
        { key: "release-2", scopeKey: "thread:thread-1" },
      ],
    });
    await t.mutation(internal.credits.releaseReservations, {
      reservationIds: releasedIds,
      reason: "cancelled_before_start",
    });
    const afterRelease = await t.run(async (ctx) =>
      await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(afterRelease?.balanceKobo).toBe(10_000);
    expect(afterRelease?.reservedKobo).toBe(0);

    const settledIds = await t.mutation(internal.credits.reserveCustomToolHolds, {
      userId,
      holds: [
        { key: "settle-1", scopeKey: "thread:thread-1" },
        { key: "settle-2", scopeKey: "thread:thread-1" },
      ],
    });
    const results = await t.mutation(internal.credits.settleCustomToolHolds, {
      holds: settledIds.map((reservationId) => ({
        reservationId,
        providerRef: "message-1",
        usage: { toolName: "spreadsheet_parse" },
        idempotencyKey: `custom_tool:${reservationId}`,
      })),
    });
    expect(results).toHaveLength(2);
    expect(results.every((row) => row.applied && row.chargedKobo === BILLING_CONFIG.customToolCapKobo)).toBe(true);

    const afterSettle = await t.run(async (ctx) =>
      await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(afterSettle?.balanceKobo).toBe(
      10_000 - BILLING_CONFIG.customToolCapKobo * 2,
    );
    expect(afterSettle?.reservedKobo).toBe(0);

    const events = await t.run(async (ctx) =>
      await ctx.db
        .query("usageEvents")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(events).toHaveLength(2);
  });

  test("recent invoices keep the plan from the top-up", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000, "pro");
    const authed = t.withIdentity({ subject: userId });

    async function markPaid(reference: string) {
      await t.run(async (ctx) => {
        const intent = await ctx.db
          .query("topupIntents")
          .withIndex("by_reference", (q) => q.eq("reference", reference))
          .first();
        if (!intent) throw new Error(`Missing intent: ${reference}`);
        await ctx.db.patch(intent._id, { status: "paid", paidAt: Date.now() });
      });
    }

    await authed.mutation(api.billing.createTopupIntent, {
      reference: "OW-test-pro",
      amount: 5000,
    });
    await markPaid("OW-test-pro");

    const firstPage = await authed.query(api.billing.invoiceHistory, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(firstPage.page).toHaveLength(1);
    expect(firstPage.page[0]).toMatchObject({ plan: "pro", status: "paid" });

    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (!wallet) throw new Error("Missing wallet");
      await ctx.db.patch(wallet._id, { plan: "basic" });
    });

    await authed.mutation(api.billing.createTopupIntent, {
      reference: "OW-test-basic",
      amount: 3000,
    });
    await markPaid("OW-test-basic");

    const page = await authed.query(api.billing.invoiceHistory, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    const planByReference = new Map(page.page.map((row) => [row.reference, row.plan]));
    expect(planByReference.get("OW-test-pro")).toBe("pro");
    expect(planByReference.get("OW-test-basic")).toBe("basic");
  });

  test("legacy invoices without a plan default to basic", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);
    const authed = t.withIdentity({ subject: userId });
    await t.run(async (ctx) => {
      await ctx.db.insert("topupIntents", {
        userId,
        reference: "OW-legacy-plan",
        amount: 6_000,
        status: "paid",
        createdAt: 1,
        paidAt: 1,
      });
    });

    const page = await authed.query(api.billing.invoiceHistory, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page[0]).toMatchObject({ reference: "OW-legacy-plan", plan: "basic" });
  });

  test("invoice history paginates in batches of 10", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    await seedWallet(t, userId, 10_000);
    const authed = t.withIdentity({ subject: userId });
    await t.run(async (ctx) => {
      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert("topupIntents", {
          userId,
          reference: `page-ref-${index}`,
          amount: 1_000 + index,
          plan: index % 2 === 0 ? "basic" : "pro",
          status: index === 0 ? "pending" : "paid",
          createdAt: index,
          paidAt: index,
        });
      }
    });

    const first = await authed.query(api.billing.invoiceHistory, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(first.page).toHaveLength(10);
    expect(first.isDone).toBe(false);
    expect(first.page.map((row) => row.reference)).not.toContain("page-ref-0");

    const second = await authed.query(api.billing.invoiceHistory, {
      paginationOpts: { numItems: 10, cursor: first.continueCursor },
    });
    expect(second.page).toHaveLength(10);
    const references = new Set(
      [...first.page, ...second.page].map((row) => row.reference),
    );
    expect(references.size).toBe(20);
  });
});
