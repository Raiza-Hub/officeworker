import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { z } from "zod";

const requestSchema = z.object({ amount: z.number().int().min(500).max(1_000_000) });

export async function POST(request: Request) {
  const token = await convexAuthNextjsToken();
  if (!token) return Response.json({ error: "Sign in to add credits." }, { status: 401 });

  let amount: number;
  try {
    amount = requestSchema.parse(await request.json()).amount;
  } catch {
    return Response.json({ error: "Choose an amount from ₦500 to ₦1,000,000." }, { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secretKey = process.env.KORAPAY_SECRET_KEY;
  const siteUrl = process.env.SITE_URL;
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexUrl || !secretKey || !siteUrl || !convexSiteUrl) {
    return Response.json({ error: "Billing is not fully configured." }, { status: 503 });
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  const reference = `OW-${crypto.randomUUID()}`;
  try {
    const intent = await client.mutation(api.billing.createTopupIntent, { reference, amount });
    const response = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "NGN",
        reference,
        narration: "Officeworker wallet top-up",
        customer: { name: intent.name, email: intent.email },
        redirect_url: `${siteUrl.replace(/\/$/, "")}/billing?payment=return`,
        notification_url: `${convexSiteUrl.replace(/\/$/, "")}/korapay-webhook`,
      }),
    });
    const result = (await response.json()) as {
      status?: boolean | string;
      message?: string;
      data?: { checkout_url?: string };
    };
    const checkoutUrl = result.data?.checkout_url;
    if (!response.ok || String(result.status) !== "true" || !checkoutUrl) {
      throw new Error(result.message || "Korapay could not start checkout.");
    }
    return Response.json({ checkoutUrl });
  } catch (error) {
    await client.mutation(api.billing.failTopupIntent, { reference }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Could not start checkout.";
    return Response.json({ error: message }, { status: 502 });
  }
}
