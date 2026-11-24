import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";
import { ensureActiveBillingCore } from "./credits";
import {
  parseExchangeRateApiRate,
  parseFrankfurterRate,
  type ParsedFxRate,
} from "../lib/billing";

const FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rate/usd/ngn";
const EXCHANGE_RATE_API_URL = "https://open.er-api.com/v6/latest/USD";

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FX request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

type FxSourceLabel = "frankfurter" | "exchangerate_api";

async function trySource(
  label: FxSourceLabel,
  url: string,
  parse: (payload: unknown) => ParsedFxRate | null,
): Promise<{ source: FxSourceLabel; parsed: ParsedFxRate; raw: unknown } | null> {
  try {
    const raw = await fetchJson(url);
    const parsed = parse(raw);
    return parsed ? { source: label, parsed, raw } : null;
  } catch (error) {
    console.error(`FX fetch failed: ${label}`, error);
    return null;
  }
}

export const refreshFxRate = internalAction({
  args: {},
  handler: async (ctx) => {
    const result =
      (await trySource(
        "frankfurter",
        FRANKFURTER_URL,
        parseFrankfurterRate,
      )) ??
      (await trySource(
        "exchangerate_api",
        EXCHANGE_RATE_API_URL,
        parseExchangeRateApiRate,
      ));

    if (!result) {
      console.warn("FX refresh failed; keeping last stored rate");
      return { updated: false };
    }

    await ctx.runMutation(internal.fx.storeFxRate, {
      source: result.source,
      usdToNgn: result.parsed.usdToNgn,
      sourceDate: result.parsed.sourceDate,
      sourceUpdatedAt: result.parsed.sourceUpdatedAt,
      rawPayload: result.raw,
    });
    return { updated: true, source: result.source, usdToNgn: result.parsed.usdToNgn };
  },
});

export const storeFxRate = internalMutation({
  args: {
    source: v.union(
      v.literal("seed"),
      v.literal("frankfurter"),
      v.literal("exchangerate_api"),
    ),
    usdToNgn: v.number(),
    sourceDate: v.optional(v.string()),
    sourceUpdatedAt: v.optional(v.number()),
    rawPayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.usdToNgn) || args.usdToNgn <= 0) {
      throw new Error("Invalid FX rate");
    }
    const { config } = await ensureActiveBillingCore(ctx);
    const previous = config.activeFxRateId
      ? await ctx.db.get(config.activeFxRateId)
      : null;
    if (previous?.active) {
      await ctx.db.patch(previous._id, { active: false });
    }
    const id = await ctx.db.insert("fxRates", {
      source: args.source,
      usdToNgn: args.usdToNgn,
      sourceDate: args.sourceDate,
      sourceUpdatedAt: args.sourceUpdatedAt,
      fetchedAt: Date.now(),
      active: true,
      rawPayload: args.rawPayload,
    });
    await ctx.db.patch(config._id, {
      activeFxRateId: id as Doc<"fxRates">["_id"],
      updatedAt: Date.now(),
    });
    return id;
  },
});
