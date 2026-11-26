import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { ensureActiveBillingCore } from "./credits";
import { generateSeedSessions } from "./seedBillingHistoryData";

const THREAD_PREFIX = "seed-billing:day-";

async function resolveUser(ctx: MutationCtx, email: string): Promise<Id<"users">> {
  const users = await ctx.db.query("users").collect();
  const user = users.find((row) => "email" in row && row.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user._id;
}

async function clearSeededData(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ threads: number; reservations: number; events: number; submissions: number }> {
  const activities = await ctx.db
    .query("threadActivity")
    .withIndex("by_user_activity", (q) => q.eq("userId", userId))
    .collect();
  const seeded = activities.filter((row) => row.threadId.startsWith(THREAD_PREFIX));
  const cleared = await Promise.all(
    seeded.map(async (activity) => {
      const scopeKey = `thread:${activity.threadId}`;
      const rows = await ctx.db
        .query("usageReservations")
        .withIndex("by_scope_status", (q) => q.eq("scopeKey", scopeKey))
        .collect();

      const [eventCounts, rowsForThread] = await Promise.all([
        Promise.all(
          rows.map(async (reservation) => {
            let events = 0;
            if (reservation.usageEventId) {
              const event = await ctx.db.get(reservation.usageEventId);
              if (event) {
                await ctx.db.delete(event._id);
                events += 1;
              }
            }
            const remainingEvents = await ctx.db
              .query("usageEvents")
              .withIndex("by_reservation", (q) => q.eq("reservationId", reservation._id))
              .collect();
            await Promise.all(
              remainingEvents.map((event) => ctx.db.delete(event._id)),
            );
            events += remainingEvents.length;
            await ctx.db.delete(reservation._id);
            return events;
          }),
        ),
        ctx.db
          .query("submissions")
          .withIndex("by_thread", (q) => q.eq("threadId", activity.threadId))
          .collect(),
      ]);
      await Promise.all(
        rowsForThread.map((submission) => ctx.db.delete(submission._id)),
      );

      await ctx.db.delete(activity._id);

      return {
        reservations: rows.length,
        events: eventCounts.reduce((sum, count) => sum + count, 0),
        submissions: rowsForThread.length,
      };
    }),
  );

  return {
    threads: cleared.length,
    reservations: cleared.reduce((sum, item) => sum + item.reservations, 0),
    events: cleared.reduce((sum, item) => sum + item.events, 0),
    submissions: cleared.reduce((sum, item) => sum + item.submissions, 0),
  };
}

export const seed = internalMutation({
  args: {
    email: v.string(),
    days: v.optional(v.number()),
    sessionsPerDay: v.optional(v.number()),
    confirm: v.literal("SEED_BILLING_HISTORY"),
  },
  handler: async (ctx, args) => {
    const days = Math.trunc(args.days ?? 90);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      throw new Error("days must be between 1 and 365");
    }
    const sessionsPerDay = Math.trunc(args.sessionsPerDay ?? 3);
    if (!Number.isFinite(sessionsPerDay) || sessionsPerDay < 1 || sessionsPerDay > 8) {
      throw new Error("sessionsPerDay must be between 1 and 8");
    }
    const userId = await resolveUser(ctx, args.email);
    await clearSeededData(ctx, userId);

    const { config, fxRate } = await ensureActiveBillingCore(ctx);
    const sessions = generateSeedSessions({ days, sessionsPerDay, now: Date.now() });

    await Promise.all(
      sessions.map(async (session) => {
        await ctx.db.insert("threadActivity", {
          userId,
          threadId: session.threadId,
          title: session.title,
          status: "active",
          lastActivityAt: session.date,
        });

        await Promise.all(
          session.operations.map(async (operation, operationIndex) => {
            const key = `seed-billing:${session.threadId}:${operationIndex}`;
            const reservationId = await ctx.db.insert("usageReservations", {
              userId,
              key,
              operation: operation.operation,
              scopeKey: `thread:${session.threadId}`,
              amountKobo: operation.holdKobo,
              usdToNgn: fxRate.usdToNgn,
              markupPct: config.markupPct,
              fxRateId: fxRate._id,
              status: "settled",
              usageEventId: undefined,
              expiresAt: session.date + 24 * 60 * 60 * 1000,
              createdAt: session.date,
              updatedAt: session.date,
            });
            const eventId = await ctx.db.insert("usageEvents", {
              userId,
              reservationId,
              operation: operation.operation,
              providerCostUsd: operation.actualKobo / 100 / fxRate.usdToNgn,
              usdToNgn: fxRate.usdToNgn,
              markupPct: config.markupPct,
              actualKobo: operation.actualKobo,
              chargeKobo: operation.chargeKobo,
              underRecoveryKobo: Math.max(0, operation.actualKobo - operation.chargeKobo),
              idempotencyKey: key,
              fxRateId: fxRate._id,
              createdAt: session.date,
            });
            await ctx.db.patch(reservationId, {
              usageEventId: eventId,
              updatedAt: session.date,
            });
          }),
        );
      }),
    );

    const threads = sessions.length;
    const reservations = sessions.reduce(
      (sum, session) => sum + session.operations.length,
      0,
    );
    const events = reservations;
    return { email: args.email, days, sessionsPerDay, threads, reservations, events };
  },
});

export const clear = internalMutation({
  args: {
    email: v.string(),
    confirm: v.literal("CLEAR_SEEDED_BILLING_HISTORY"),
  },
  handler: async (ctx, args) => {
    const userId = await resolveUser(ctx, args.email);
    return await clearSeededData(ctx, userId);
  },
});
