import { describe, expect, test } from "bun:test";
import {
  generateSeedSessions,
  type SeedSession,
} from "../convex/seedBillingHistoryData";

const now = Date.UTC(2026, 10, 23, 15, 0, 0);
const options = { days: 40, sessionsPerDay: 3, now };

function dayOf(session: SeedSession): number {
  return Number(session.threadId.match(/day-(\d+)/)?.[1]);
}

describe("generateSeedSessions", () => {
  test("is deterministic and gives multiple sessions per day", () => {
    const sessions = generateSeedSessions(options);
    expect(sessions).toEqual(generateSeedSessions(options));

    const counts = new Map<number, number>();
    for (const session of sessions) {
      const day = dayOf(session);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const activeDays = [...counts.values()];
    expect(activeDays.length > 30).toBe(true);
    expect(activeDays.every((count) => count >= 2 && count <= 4)).toBe(true);
  });

  test("places every session inside its UTC day", () => {
    const sessions = generateSeedSessions(options);
    const todayUtc = Date.UTC(2026, 10, 23);
    for (const session of sessions) {
      const expected = todayUtc - (options.days - 1 - dayOf(session)) * 86_400_000;
      const date = new Date(session.date);
      expect(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toBe(
        expected,
      );
    }
  });

  test("produces sessions with varied charges", () => {
    const sessions = generateSeedSessions(options);
    const charges = sessions.flatMap((session) =>
      session.operations.map((operation) => operation.chargeKobo),
    );
    expect(charges.some((charge) => charge > 0)).toBe(true);
    expect(new Set(charges).size > 1).toBe(true);
  });

  test("zero and empty days create no candles", () => {
    const sessions = generateSeedSessions(options);
    const emptyDays = new Set(
      Array.from({ length: options.days - 10 }, (_, day) => day)
        .filter((day) => day % 19 === 6),
    );
    for (const session of sessions) {
      expect(emptyDays.has(dayOf(session))).toBe(false);
    }

    const zeroDay = 7;
    const byDay = new Map<number, SeedSession[]>();
    for (const session of sessions) {
      const day = dayOf(session);
      const group = byDay.get(day) ?? [];
      group.push(session);
      byDay.set(day, group);
    }
    const zeroSessions = byDay.get(zeroDay) ?? [];
    expect(zeroSessions.length > 0).toBe(true);
    expect(
      zeroSessions.every((session) =>
        session.operations.every((op) => op.chargeKobo === 0),
      ),
    ).toBe(true);
  });
});
