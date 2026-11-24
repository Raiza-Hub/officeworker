export const BILLING_CONFIG = {
  markupPct: 80,
  holdSafetyFactor: 1.25,
  browserUseMaxCostUsd: 0.1,
  chatTurnCapKobo: 2_000,
  titleCapKobo: 500,
  customToolCapKobo: 2_000,
  pdfCapKobo: 2_000,
  staleHoldMs: 10 * 60 * 1000,
  seedFx: {
    usdToNgn: 1380.94,
    sourceDate: "2026-11-22",
  },
} as const;

export type BillingOperation =
  | "chat"
  | "title"
  | "pdf"
  | "browser_use"
  | "custom_tool";

export type FxSnapshot = {
  usdToNgn: number;
  markupPct: number;
};

export type ParsedFxRate = {
  usdToNgn: number;
  sourceDate?: string;
  sourceUpdatedAt?: number;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function usdToKobo(costUsd: number, fx: FxSnapshot): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) return 0;
  if (!Number.isFinite(fx.usdToNgn) || fx.usdToNgn <= 0) return 0;
  return Math.ceil(
    costUsd * fx.usdToNgn * (1 + fx.markupPct / 100) * 100,
  );
}

export function usdForKobo(kobo: number, fx: FxSnapshot): number {
  if (!Number.isFinite(kobo) || kobo < 0) return 0;
  if (!Number.isFinite(fx.usdToNgn) || fx.usdToNgn <= 0) return 0;
  return kobo / (fx.usdToNgn * (1 + fx.markupPct / 100) * 100);
}

export function holdForUsdCost(
  costUsd: number,
  fx: FxSnapshot,
  safetyFactor = BILLING_CONFIG.holdSafetyFactor,
): number {
  return Math.ceil(usdToKobo(costUsd, fx) * safetyFactor);
}

export type SettlementInput = {
  holdKobo: number;
  capKobo: number;
  providerCostUsd: number;
  fx: FxSnapshot;
  balanceKobo: number;
  reservedKobo: number;
  flatChargeKobo?: number;
};

export type SettlementResult = {
  actualKobo: number;
  cappedKobo: number;
  chargeKobo: number;
  underRecoveryKobo: number;
  newBalanceKobo: number;
  newReservedKobo: number;
};

export function computeSettlement(input: SettlementInput): SettlementResult {
  const flatKobo = input.flatChargeKobo;
  const actualKobo =
    flatKobo !== undefined && Number.isFinite(flatKobo) && flatKobo >= 0
      ? Math.ceil(flatKobo)
      : usdToKobo(input.providerCostUsd, input.fx);
  const cappedKobo = Math.min(actualKobo, Math.max(0, input.capKobo));
  const availableKobo = Math.max(0, input.balanceKobo - input.reservedKobo);
  const chargeKobo = Math.min(cappedKobo, availableKobo);
  return {
    actualKobo,
    cappedKobo,
    chargeKobo,
    underRecoveryKobo: Math.max(0, actualKobo - chargeKobo),
    newBalanceKobo: Math.max(0, input.balanceKobo - chargeKobo),
    newReservedKobo: Math.max(0, input.reservedKobo - Math.max(0, input.holdKobo)),
  };
}

export function parseFrankfurterRate(payload: unknown): ParsedFxRate | null {
  if (!isRecord(payload)) return null;
  if (String(payload.base ?? "").toUpperCase() !== "USD") return null;
  if (String(payload.quote ?? "").toUpperCase() !== "NGN") return null;
  const rate = positiveNumber(payload.rate);
  if (rate === null) return null;
  return {
    usdToNgn: rate,
    sourceDate: typeof payload.date === "string" ? payload.date : undefined,
  };
}

export function parseExchangeRateApiRate(payload: unknown): ParsedFxRate | null {
  if (!isRecord(payload) || payload.result !== "success") return null;
  if (String(payload.base_code ?? "").toUpperCase() !== "USD") return null;
  const rates = isRecord(payload.rates) ? payload.rates : null;
  if (!rates) return null;
  const rate = positiveNumber(rates.NGN);
  if (rate === null) return null;
  const updatedAt = positiveNumber(payload.time_last_update_unix);
  return {
    usdToNgn: rate,
    sourceDate:
      typeof payload.time_last_update_utc === "string"
        ? payload.time_last_update_utc
        : undefined,
    sourceUpdatedAt: updatedAt === null ? undefined : Math.round(updatedAt * 1000),
  };
}

export function openRouterCostUsd(
  usage: unknown,
  providerMetadata: unknown,
): number | null {
  const usageRecord = isRecord(usage) ? usage : {};
  const metadataRecord = isRecord(providerMetadata) ? providerMetadata : {};
  const openrouter = isRecord(metadataRecord.openrouter)
    ? metadataRecord.openrouter
    : {};
  const openrouterUsage = isRecord(openrouter.usage) ? openrouter.usage : {};
  const rawUsage = isRecord(usageRecord.raw) ? usageRecord.raw : {};
  const candidates = [
    openrouterUsage.cost,
    rawUsage.cost,
    usageRecord.cost,
  ];
  for (const candidate of candidates) {
    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= 0
    ) {
      return candidate;
    }
  }
  return null;
}

export function estimateOpenRouterCostUsd(usage: unknown): number {
  if (!isRecord(usage)) return 0;
  const inputTokens =
    typeof usage.inputTokens === "number" && Number.isFinite(usage.inputTokens)
      ? usage.inputTokens
      : 0;
  const outputTokens =
    typeof usage.outputTokens === "number" && Number.isFinite(usage.outputTokens)
      ? usage.outputTokens
      : 0;
  return inputTokens * 0.0000000399 + outputTokens * 0.0000000784;
}
