import { describe, expect, test } from "bun:test";
import {
  BILLING_CONFIG,
  computeSettlement,
  estimateOpenRouterCostUsd,
  holdForUsdCost,
  koboToNaira,
  nairaToKobo,
  openRouterCostUsd,
  parseExchangeRateApiRate,
  parseFrankfurterRate,
  usdForKobo,
  usdToKobo,
  type FxSnapshot,
} from "../lib/billing";

const fx: FxSnapshot = {
  usdToNgn: BILLING_CONFIG.seedFx.usdToNgn,
  markupPct: BILLING_CONFIG.markupPct,
};

describe("billing helpers", () => {
  test("converts naira and kobo", () => {
    expect(nairaToKobo(1234.56)).toBe(123456);
    expect(koboToNaira(123456)).toBe(1234.56);
  });

  test("applies FX markup and safety factor", () => {
    expect(usdToKobo(0.01, fx)).toBe(2486);
    expect(holdForUsdCost(0.01, fx)).toBe(3108);
    expect(usdToKobo(-1, fx)).toBe(0);
    expect(usdToKobo(1, { usdToNgn: 0, markupPct: 80 })).toBe(0);
  });

  test("settles within cap and releases hold", () => {
    const result = computeSettlement({
      holdKobo: 3108,
      capKobo: BILLING_CONFIG.chatTurnCapKobo,
      providerCostUsd: 0.01,
      fx,
      balanceKobo: 10_000,
      reservedKobo: 3108,
    });
    expect(result.actualKobo).toBe(2486);
    expect(result.cappedKobo).toBe(2000);
    expect(result.chargeKobo).toBe(2000);
    expect(result.underRecoveryKobo).toBe(486);
    expect(result.newBalanceKobo).toBe(8000);
    expect(result.newReservedKobo).toBe(0);
  });

  test("charges only available balance and records under-recovery", () => {
    const result = computeSettlement({
      holdKobo: 2000,
      capKobo: 2000,
      providerCostUsd: 0.01,
      fx,
      balanceKobo: 3000,
      reservedKobo: 2500,
    });
    expect(result.chargeKobo).toBe(500);
    expect(result.underRecoveryKobo).toBe(1986);
    expect(result.newBalanceKobo).toBe(2500);
    expect(result.newReservedKobo).toBe(500);
  });

  test("settles a flat custom tool charge at the cap", () => {
    const result = computeSettlement({
      holdKobo: BILLING_CONFIG.customToolCapKobo,
      capKobo: BILLING_CONFIG.customToolCapKobo,
      providerCostUsd: 0,
      fx,
      balanceKobo: 10_000,
      reservedKobo: BILLING_CONFIG.customToolCapKobo,
      flatChargeKobo: BILLING_CONFIG.customToolCapKobo,
    });
    expect(result.actualKobo).toBe(2000);
    expect(result.cappedKobo).toBe(2000);
    expect(result.chargeKobo).toBe(2000);
    expect(result.underRecoveryKobo).toBe(0);
    expect(result.newBalanceKobo).toBe(8000);
    expect(result.newReservedKobo).toBe(0);
  });

  test("limits a flat custom tool charge to available balance", () => {
    const result = computeSettlement({
      holdKobo: BILLING_CONFIG.customToolCapKobo,
      capKobo: BILLING_CONFIG.customToolCapKobo,
      providerCostUsd: 0,
      fx,
      balanceKobo: 3000,
      reservedKobo: 2500,
      flatChargeKobo: BILLING_CONFIG.customToolCapKobo,
    });
    expect(result.chargeKobo).toBe(500);
    expect(result.underRecoveryKobo).toBe(1500);
    expect(result.newBalanceKobo).toBe(2500);
    expect(result.newReservedKobo).toBe(500);
  });

  test("converts a flat kobo charge back to a matching USD amount", () => {
    const costUsd = usdForKobo(BILLING_CONFIG.customToolCapKobo, fx);
    const converted = usdToKobo(costUsd, fx);
    expect(converted).toBeGreaterThanOrEqual(BILLING_CONFIG.customToolCapKobo);
    expect(converted).toBeLessThanOrEqual(BILLING_CONFIG.customToolCapKobo + 1);
  });

  test("parses Frankfurter and ExchangeRate-API payloads", () => {
    expect(
      parseFrankfurterRate({
        base: "USD",
        quote: "NGN",
        rate: 1380.94,
        date: "2026-11-22",
      }),
    ).toEqual({ usdToNgn: 1380.94, sourceDate: "2026-11-22" });
    expect(
      parseExchangeRateApiRate({
        result: "success",
        base_code: "USD",
        rates: { NGN: 1381.5 },
        time_last_update_unix: 1763760000,
        time_last_update_utc: "Sun, 22 Nov 2026 00:00:00 +0000",
      }),
    ).toEqual({
      usdToNgn: 1381.5,
      sourceDate: "Sun, 22 Nov 2026 00:00:00 +0000",
      sourceUpdatedAt: 1763760000000,
    });
  });

  test("rejects invalid FX payloads", () => {
    expect(parseFrankfurterRate({ base: "EUR", quote: "NGN", rate: 1 })).toBeNull();
    expect(parseFrankfurterRate({ base: "USD", quote: "NGN", rate: -1 })).toBeNull();
    expect(parseExchangeRateApiRate({ result: "error", rates: { NGN: 1 } })).toBeNull();
    expect(parseExchangeRateApiRate({ result: "success", base_code: "USD", rates: {} })).toBeNull();
  });

  test("reads actual provider cost and estimates from tokens", () => {
    expect(
      openRouterCostUsd(
        { inputTokens: 10, outputTokens: 5 },
        { openrouter: { usage: { cost: 0.0025 } } },
      ),
    ).toBe(0.0025);
    expect(openRouterCostUsd({}, {})).toBeNull();
    expect(estimateOpenRouterCostUsd({ inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(
      0.0399,
      6,
    );
    expect(estimateOpenRouterCostUsd({ inputTokens: 0, outputTokens: 1_000_000 })).toBeCloseTo(
      0.0784,
      6,
    );
  });
});
