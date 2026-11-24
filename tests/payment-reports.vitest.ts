import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

type Test = TestConvex<typeof schema>;

async function seedUser(t: Test, email: string) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("users", {
      name: "Test User",
      email,
      emailVerificationTime: Date.now(),
    }),
  );
}

async function seedIntent(
  t: Test,
  userId: Awaited<ReturnType<typeof seedUser>>,
  reference: string,
) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("topupIntents", {
      userId,
      reference,
      amount: 5_000,
      plan: "pro",
      status: "paid",
      createdAt: Date.now(),
      paidAt: Date.now(),
    }),
  );
}

describe("payment reports", () => {
  test("creates a report linked to the reported payment", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "reporter@example.com");
    const intentId = await seedIntent(t, userId, "OW-report-1");
    const authed = t.withIdentity({ subject: userId });

    const result = await authed.mutation(api.paymentReports.create, { intentId });
    expect(result.reference).toBe("OW-report-1");
    expect(typeof result.reportId).toBe("string");

    const reports = await t.run(async (ctx) =>
      await ctx.db
        .query("paymentReports")
        .withIndex("by_intent", (q) => q.eq("intentId", intentId))
        .collect(),
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      userId,
      intentId,
      reference: "OW-report-1",
      amount: 5_000,
      plan: "pro",
      paymentStatus: "paid",
      status: "open",
    });
  });

  test("creates a report for a legacy payment without a plan", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "legacy@example.com");
    const intentId = await t.run(async (ctx) =>
      await ctx.db.insert("topupIntents", {
        userId,
        reference: "OW-report-legacy",
        amount: 7_000,
        status: "paid",
        createdAt: Date.now(),
        paidAt: Date.now(),
      }),
    );

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.paymentReports.create, { intentId });
    expect(result.reference).toBe("OW-report-legacy");

    const report = await t.run(async (ctx) =>
      await ctx.db
        .query("paymentReports")
        .withIndex("by_intent", (q) => q.eq("intentId", intentId))
        .first(),
    );
    expect(report?.plan).toBe("basic");
  });

  test("rejects reporting another user's payment", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await seedUser(t, "owner@example.com");
    const otherId = await seedUser(t, "other@example.com");
    const intentId = await seedIntent(t, ownerId, "OW-report-2");

    await expect(
      t
        .withIdentity({ subject: otherId })
        .mutation(api.paymentReports.create, { intentId }),
    ).rejects.toThrow("Payment not found");
  });

  test("allows multiple reports for the same payment and lists them", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "reporter@example.com");
    const intentId = await seedIntent(t, userId, "OW-report-3");
    const authed = t.withIdentity({ subject: userId });

    await authed.mutation(api.paymentReports.create, { intentId });
    await authed.mutation(api.paymentReports.create, { intentId });

    const reports = await t.query(internal.paymentReports.listByIntent, {
      intentId,
    });
    expect(reports).toHaveLength(2);
    expect(reports.every((report) => report.intentId === intentId)).toBe(true);
  });

  test("listMine returns only the signed-in user's reports", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "reporter@example.com");
    const otherId = await seedUser(t, "other@example.com");
    const intentId = await seedIntent(t, userId, "OW-report-4");
    const otherIntentId = await seedIntent(t, otherId, "OW-report-5");
    const authed = t.withIdentity({ subject: userId });

    await authed.mutation(api.paymentReports.create, { intentId });
    await t
      .withIdentity({ subject: otherId })
      .mutation(api.paymentReports.create, { intentId: otherIntentId });

    const reports = await authed.query(api.paymentReports.listMine, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(reports.page).toHaveLength(1);
    expect(reports.page[0]?.userId).toBe(userId);
    expect(reports.page[0]?.reference).toBe("OW-report-4");
  });

  test("listMine paginates in batches of 10", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "reporter@example.com");
    const intentId = await seedIntent(t, userId, "OW-report-paged");
    const authed = t.withIdentity({ subject: userId });

    for (let index = 0; index < 12; index += 1) {
      await authed.mutation(api.paymentReports.create, { intentId });
    }

    const first = await authed.query(api.paymentReports.listMine, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(first.page).toHaveLength(10);
    expect(first.isDone).toBe(false);

    const second = await authed.query(api.paymentReports.listMine, {
      paginationOpts: { numItems: 10, cursor: first.continueCursor },
    });
    expect(second.page).toHaveLength(2);
    expect(second.isDone).toBe(true);

    const ids = new Set([...first.page, ...second.page].map((report) => report._id));
    expect(ids.size).toBe(12);
  });

  test("setStatus updates status and the updated date", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "reporter@example.com");
    const intentId = await seedIntent(t, userId, "OW-report-6");
    const { reportId } = await t
      .withIdentity({ subject: userId })
      .mutation(api.paymentReports.create, { intentId });

    await t.run(async (ctx) => {
      await ctx.db.patch(reportId, { updatedAt: 1 });
    });

    const updated = await t.mutation(internal.paymentReports.setStatus, {
      reportId,
      status: "resolved",
    });
    expect(updated.status).toBe("resolved");
    expect(updated.updatedAt).toBeGreaterThan(1);

    const stored = await t.run(async (ctx) => await ctx.db.get(reportId));
    expect(stored?.status).toBe("resolved");
    expect(stored?.updatedAt).toBe(updated.updatedAt);
  });
});
