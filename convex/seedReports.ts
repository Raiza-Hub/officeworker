import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { normalizeTopupPlan } from "../lib/invoice";

const SEED_REFERENCE_PREFIX = "seed:invoice:";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

async function resolveUser(
  ctx: MutationCtx,
  email: string,
): Promise<Id<"users">> {
  const users = await ctx.db.query("users").collect();
  const user = users.find((row) => "email" in row && row.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user._id;
}

async function clearSeededReports(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const reports = await ctx.db
    .query("paymentReports")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .collect();
  let removed = 0;
  for (const report of reports) {
    if (report.reference.startsWith(SEED_REFERENCE_PREFIX)) {
      await ctx.db.delete(report._id);
      removed += 1;
    }
  }
  return removed;
}

export const seed = internalMutation({
  args: {
    email: v.string(),
    count: v.optional(v.number()),
    confirm: v.literal("SEED_REPORTS"),
  },
  handler: async (ctx, args) => {
    const count = Math.trunc(args.count ?? 60);
    if (!Number.isFinite(count) || count < 1 || count > 180) {
      throw new Error("count must be between 1 and 180");
    }
    const userId = await resolveUser(ctx, args.email);
    const removed = await clearSeededReports(ctx, userId);
    const sourceCount = Math.ceil(count / 3);
    const intents = await ctx.db
      .query("topupIntents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .filter((q) => q.neq(q.field("status"), "pending"))
      .collect();
    const seededIntents = intents
      .filter((intent) => intent.reference.startsWith(SEED_REFERENCE_PREFIX))
      .slice(0, sourceCount);
    if (seededIntents.length < sourceCount) {
      throw new Error(
        `Need ${sourceCount} seeded invoices, found ${seededIntents.length}`,
      );
    }

    const now = Date.now();
    let open = 0;
    let resolved = 0;

    for (let index = 0; index < count; index += 1) {
      const intent = seededIntents[Math.floor(index / 3)]!;
      const status = index % 4 === 3 ? "resolved" : "open";
      const createdAt = now - (index + 1) * DAY_MS - (index % 3) * HOUR_MS;
      const updatedAt =
        status === "resolved"
          ? createdAt + (6 + (index % 5)) * HOUR_MS
          : createdAt;
      await ctx.db.insert("paymentReports", {
        userId,
        intentId: intent._id,
        reference: intent.reference,
        amount: intent.amount,
        plan: normalizeTopupPlan(intent.plan),
        paymentStatus: intent.status === "failed" ? "failed" : "paid",
        status,
        createdAt,
        updatedAt,
      });
      if (status === "open") open += 1;
      else resolved += 1;
    }

    return { email: args.email, count, removed, open, resolved };
  },
});

export const clear = internalMutation({
  args: {
    email: v.string(),
    confirm: v.literal("CLEAR_SEEDED_REPORTS"),
  },
  handler: async (ctx, args) => {
    const userId = await resolveUser(ctx, args.email);
    return { removed: await clearSeededReports(ctx, userId) };
  },
});
