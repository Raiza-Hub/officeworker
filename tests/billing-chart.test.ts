import { describe, expect, test } from "bun:test";
import {
  buildDailyUsageHistory,
  buildThreadBillingCandle,
  filterCandlesByRange,
  sortCandlesAscending,
  type ThreadBillingCandleInput,
} from "../lib/billing-chart";

const baseInput: ThreadBillingCandleInput = {
  threadId: "thread-1",
  title: "Payroll portal",
  date: new Date("2026-11-20T12:00:00.000Z").getTime(),
  totalHeldKobo: 7500,
  totalChargedKobo: 7200,
  totalProviderCostKobo: 8000,
  underRecoveryKobo: 800,
  lowestSingleChargeKobo: 400,
  actionCount: 4,
  turnCount: 1,
  browserUse: true,
};

describe("buildThreadBillingCandle", () => {
  test("builds an overbudget candle with the overage wick", () => {
    const candle = buildThreadBillingCandle(baseInput);
    expect(candle.open).toBe(7500);
    expect(candle.close).toBe(7200);
    expect(candle.high).toBe(8000);
    expect(candle.low).toBe(400);
    expect(candle.lowestSingleChargeKobo).toBe(400);
    expect(candle.overageKobo).toBe(500);
  });

  test("builds an under-budget candle without overage", () => {
    const candle = buildThreadBillingCandle({
      ...baseInput,
      totalProviderCostKobo: 7000,
      underRecoveryKobo: 0,
    });
    expect(candle.high).toBe(7500);
    expect(candle.overageKobo).toBe(0);
  });
});

describe("sortCandlesAscending", () => {
  test("sorts candles oldest first", () => {
    const candles = [
      buildThreadBillingCandle(baseInput),
      buildThreadBillingCandle({
        ...baseInput,
        threadId: "thread-2",
        date: new Date("2026-11-05T12:00:00.000Z").getTime(),
      }),
      buildThreadBillingCandle({
        ...baseInput,
        threadId: "thread-3",
        date: new Date("2026-10-01T12:00:00.000Z").getTime(),
      }),
    ];

    expect(
      sortCandlesAscending(candles).map((candle) => candle.threadId),
    ).toEqual(["thread-3", "thread-2", "thread-1"]);
  });
});

describe("filterCandlesByRange", () => {
  const now = new Date("2026-11-20T23:59:59.000Z");
  const candles = [
    buildThreadBillingCandle({
      ...baseInput,
      threadId: "thread-3",
      date: new Date("2026-10-01T12:00:00.000Z").getTime(),
    }),
    buildThreadBillingCandle({
      ...baseInput,
      threadId: "thread-2",
      date: new Date("2026-11-05T12:00:00.000Z").getTime(),
    }),
    buildThreadBillingCandle(baseInput),
  ];

  test("keeps only candles inside the selected range", () => {
    expect(
      filterCandlesByRange(candles, "14 days", now).map((candle) => candle.threadId),
    ).toEqual(["thread-1"]);
    expect(
      filterCandlesByRange(candles, "30 days", now).map((candle) => candle.threadId),
    ).toEqual(["thread-2", "thread-1"]);
    expect(
      filterCandlesByRange(candles, "3 months", now).map((candle) => candle.threadId),
    ).toEqual(["thread-3", "thread-2", "thread-1"]);
  });
});

describe("buildDailyUsageHistory", () => {
  test("groups sessions by UTC day and converts charges to naira", () => {
    const candles = [
      buildThreadBillingCandle({
        ...baseInput,
        threadId: "thread-1",
        date: new Date("2026-11-20T01:00:00.000Z").getTime(),
        totalChargedKobo: 7200,
      }),
      buildThreadBillingCandle({
        ...baseInput,
        threadId: "thread-2",
        date: new Date("2026-11-20T23:30:00.000Z").getTime(),
        totalChargedKobo: 2800,
      }),
      buildThreadBillingCandle({
        ...baseInput,
        threadId: "thread-3",
        date: new Date("2026-11-21T12:00:00.000Z").getTime(),
        totalChargedKobo: 3500,
      }),
    ];

    expect(buildDailyUsageHistory(candles)).toEqual([
      { date: "2026-11-20", session: 2, price: 100 },
      { date: "2026-11-21", session: 1, price: 35 },
    ]);
  });

  test("keeps zero-charge days with a zero price", () => {
    const candle = buildThreadBillingCandle({
      ...baseInput,
      totalHeldKobo: 0,
      totalChargedKobo: 0,
      totalProviderCostKobo: 0,
    });

    expect(buildDailyUsageHistory([candle])).toEqual([
      { date: "2026-11-20", session: 1, price: 0 },
    ]);
  });
});
