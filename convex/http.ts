import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyKorapaySignature(data: unknown, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return safeEqual(toHex(new Uint8Array(digest)), signature.toLowerCase());
}

function normalizePaymentMethod(value: unknown): string | undefined {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? ((value as { type?: unknown; name?: unknown; method?: unknown }).type ??
          (value as { type?: unknown; name?: unknown; method?: unknown }).name ??
          (value as { type?: unknown; name?: unknown; method?: unknown }).method)
        : undefined;
  if (typeof raw !== "string") return undefined;
  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (!normalized) return undefined;
  if (normalized.includes("card")) return "Card";
  if (normalized.includes("pay with bank")) return "Pay with bank";
  if (normalized.includes("bank transfer") || normalized === "bank" || normalized === "transfer") {
    return "Bank transfer";
  }
  if (normalized.includes("paywithbank")) return "Pay with bank";
  if (normalized.includes("banktransfer")) return "Bank transfer";
  return undefined;
}

function extractPaymentMethod(...sources: Array<Record<string, unknown> | undefined>): string {
  for (const source of sources) {
    if (!source) continue;
    for (const key of [
      "payment_method",
      "paymentMethod",
      "channel",
      "payment_type",
      "payment_channel",
      "method",
      "authorization",
    ]) {
      const label = normalizePaymentMethod(source[key]);
      if (label) return label;
    }
  }
  return "Korapay";
}

const korapayWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.KORAPAY_SECRET_KEY;
  const signature = request.headers.get("x-korapay-signature");
  if (!secret || !signature) return jsonError("Invalid webhook signature", 401);

  let payload: {
    event?: string | { event?: string; type?: string } | { type?: string };
    data?: Record<string, unknown>;
  };
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid webhook JSON");
  }
  if (!(await verifyKorapaySignature(payload.data, signature, secret))) {
    return jsonError("Invalid webhook signature", 401);
  }

  const eventType =
    typeof payload.event === "string"
      ? payload.event
      : (payload.event as { type?: string } | undefined)?.type;
  const payloadData = payload.data ?? {};
  const payloadRef =
    typeof payloadData.reference === "string" ? payloadData.reference : undefined;
  if ((eventType !== "charge.success" && eventType !== "charge.failed") || !payloadRef) {
    return Response.json({ ok: true, ignored: true });
  }

  try {
    const verification = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(payloadRef)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const result = (await verification.json()) as {
      status?: boolean | string;
      data?: Record<string, unknown>;
    };
    const verified = result.data;
    if (!verification.ok || String(result.status) !== "true" || !verified) {
      return jsonError("Korapay has not verified this payment", 400);
    }

    const verifiedRef =
      typeof verified.reference === "string" ? verified.reference : undefined;
    const verifiedPaymentRef =
      typeof verified.payment_reference === "string" ? verified.payment_reference : undefined;
    const payloadPaymentRef =
      typeof payloadData.payment_reference === "string"
        ? payloadData.payment_reference
        : undefined;
    const reference = verifiedPaymentRef ?? payloadPaymentRef ?? verifiedRef ?? payloadRef;
    const paymentMethod = extractPaymentMethod(verified, payloadData);
    const gatewayStatus =
      typeof verified.status === "string"
        ? verified.status
        : typeof payloadData.status === "string"
          ? payloadData.status
          : undefined;
    const currency =
      (typeof verified.currency === "string" ? verified.currency : undefined) ??
      (typeof payloadData.currency === "string" ? payloadData.currency : undefined) ??
      "";

    if (eventType === "charge.failed" || verified.status === "failed") {
      await ctx.runMutation(internal.billing.markTopupFailed, {
        reference,
        paymentMethod,
        gatewayStatus: gatewayStatus ?? "failed",
        gatewayReference: verifiedRef ?? payloadRef,
        currency: currency || undefined,
      });
      return Response.json({ ok: true });
    }

    if (verified.status !== "success") {
      return jsonError("Korapay has not verified this payment", 400);
    }

    const amount = Number(verified.amount_paid ?? verified.amount ?? payloadData.amount);
    await ctx.runMutation(internal.billing.applyTopup, {
      reference,
      amount,
      currency,
      paymentMethod,
      gatewayStatus: "success",
      gatewayReference: verifiedRef ?? payloadRef,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not apply top-up", 422);
  }
});

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/billing/korapay-webhook",
  method: "POST",
  handler: korapayWebhook,
});

export default http;
