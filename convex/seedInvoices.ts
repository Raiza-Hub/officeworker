import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";

const SEED_REFERENCE_PREFIX = "seed:invoice:";
const DAY_MS = 24 * 60 * 60 * 1000;

async function resolveUser(ctx: MutationCtx, email: string): Promise<Id<"users">> {
  const users = await ctx.db.query("users").collect();
  const user = users.find((row) => "email" in row && row.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user._id;
}

async function clearSeededInvoices(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const intents = await ctx.db
    .query("topupIntents")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .collect();
  const seeded = intents.filter((intent) =>
    intent.reference.startsWith(SEED_REFERENCE_PREFIX),
  );
  await Promise.all(seeded.map((intent) => ctx.db.delete(intent._id)));
  return seeded.length;
}

export const seed = internalMutation({
  args: {
    email: v.string(),
    count: v.optional(v.number()),
    confirm: v.literal("SEED_INVOICES"),
  },
  handler: async (ctx, args) => {
    const count = Math.trunc(args.count ?? 60);
    if (!Number.isFinite(count) || count < 1 || count > 200) {
      throw new Error("count must be between 1 and 200");
    }
    const userId = await resolveUser(ctx, args.email);
    const removed = await clearSeededInvoices(ctx, userId);
    const now = Date.now();
    const baseAmount = 2_000 + ((now % 7) + 1) * 250;
    const invoices = Array.from({ length: count }, (_, index) => {
      const status: "paid" | "failed" = index % 10 === 9 ? "failed" : "paid";
      const plan: "pro" | "basic" = index % 3 === 0 ? "pro" : "basic";
      const gatewayStatus: "success" | "failed" =
        status === "paid" ? "success" : "failed";
      const createdAt = now - index * DAY_MS - (index % 3) * 60 * 60 * 1000;
      return {
        userId,
        reference: `${SEED_REFERENCE_PREFIX}${String(index + 1).padStart(2, "0")}`,
        amount: baseAmount + ((index * 1_750) % 48_000),
        plan,
        status,
        createdAt,
        paidAt: status === "paid" ? createdAt : undefined,
        updatedAt: createdAt,
        paymentMethod: "Seed",
        gatewayStatus,
        currency: "NGN",
      };
    });
    await Promise.all(
      invoices.map((invoice) => ctx.db.insert("topupIntents", invoice)),
    );
    const paid = invoices.filter((invoice) => invoice.status === "paid").length;
    const failed = invoices.filter((invoice) => invoice.status === "failed").length;

    return { email: args.email, count, removed, paid, failed };
  },
});

export const clear = internalMutation({
  args: {
    email: v.string(),
    confirm: v.literal("CLEAR_SEEDED_INVOICES"),
  },
  handler: async (ctx, args) => {
    const userId = await resolveUser(ctx, args.email);
    return { removed: await clearSeededInvoices(ctx, userId) };
  },
});
