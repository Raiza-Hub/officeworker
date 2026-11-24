export type ThreadBillingCandleInput = {
  threadId: string;
  title?: string | null;
  date: number;
  totalHeldKobo: number;
  totalChargedKobo: number;
  totalProviderCostKobo: number;
  underRecoveryKobo: number;
  lowestSingleChargeKobo: number;
  actionCount: number;
  turnCount: number;
  browserUse: boolean;
  spreadsheetCharge?: boolean;
};

export type ThreadBillingCandle = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  threadId: string;
  title: string | null;
  heldKobo: number;
  chargedKobo: number;
  providerCostKobo: number;
  lowestSingleChargeKobo: number;
  overageKobo: number;
  underRecoveryKobo: number;
  actionCount: number;
  turnCount: number;
  browserUse: boolean;
  spreadsheetCharge: boolean;
  zeroCharge: boolean;
  sessionCount: number;
};

export function buildThreadBillingCandle(
  input: ThreadBillingCandleInput,
): ThreadBillingCandle {
  const open = Math.max(0, input.totalHeldKobo);
  const close = Math.max(0, input.totalChargedKobo);
  const providerCostKobo = Math.max(0, input.totalProviderCostKobo);
  const high = Math.max(open, close, providerCostKobo);
  const lowestSingleChargeKobo = Math.max(0, input.lowestSingleChargeKobo);
  const low = Math.max(0, Math.min(lowestSingleChargeKobo, close, open));
  const overageKobo = Math.max(0, providerCostKobo - open);
  return {
    date: new Date(input.date),
    open,
    high,
    low,
    close,
    threadId: input.threadId,
    title: input.title ?? null,
    heldKobo: open,
    chargedKobo: close,
    providerCostKobo,
    lowestSingleChargeKobo,
    overageKobo,
    underRecoveryKobo: Math.max(0, input.underRecoveryKobo),
    actionCount: Math.max(0, input.actionCount),
    turnCount: Math.max(0, input.turnCount),
    browserUse: input.browserUse,
    spreadsheetCharge: input.spreadsheetCharge ?? false,
    zeroCharge: input.actionCount > 0 && close === 0,
    sessionCount: 1,
  };
}

export function sortCandlesAscending(
  candles: readonly ThreadBillingCandle[],
): ThreadBillingCandle[] {
  return [...candles].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type BillingRange = "3 months" | "30 days" | "14 days";

export const BILLING_DAY_MS = 86_400_000;

export const RANGE_DAYS: Record<BillingRange, number> = {
  "3 months": 90,
  "30 days": 30,
  "14 days": 14,
};

export function filterCandlesByRange(
  candles: readonly ThreadBillingCandle[],
  range: BillingRange,
  now: Date = new Date(),
): ThreadBillingCandle[] {
  const cutoff = now.getTime() - RANGE_DAYS[range] * BILLING_DAY_MS;
  return candles.filter((candle) => candle.date.getTime() >= cutoff);
}

export type UsageHistoryPoint = {
  readonly date: string;
  readonly session: number;
  readonly price: number;
};

export function buildDailyUsageHistory(
  candles: readonly ThreadBillingCandle[],
): UsageHistoryPoint[] {
  const byDate = new Map<string, { session: number; priceKobo: number }>();

  for (const candle of candles) {
    const date = candle.date.toISOString().slice(0, 10);
    const bucket = byDate.get(date) ?? { session: 0, priceKobo: 0 };
    bucket.session += 1;
    bucket.priceKobo += candle.chargedKobo;
    byDate.set(date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      session: bucket.session,
      price: Number((bucket.priceKobo / 100).toFixed(2)),
    }));
}
