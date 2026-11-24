const DAY_MS = 24 * 60 * 60 * 1000;

export type SeedOperation = {
  operation: "chat" | "browser_use" | "custom_tool";
  holdKobo: number;
  chargeKobo: number;
  actualKobo: number;
};

export type SeedSession = {
  threadId: string;
  title: string;
  date: number;
  operations: SeedOperation[];
};

export type GenerateSeedOptions = {
  days: number;
  sessionsPerDay: number;
  now: number;
};

export function hashSeed(seed: number): number {
  let state = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  state = (state ^ (state >>> 13)) >>> 0;
  state = Math.imul(state, 0xc2b2ae35) >>> 0;
  state = (state ^ (state >>> 16)) >>> 0;
  return state / 0x1_0000_0000;
}

function makeOperation(
  operation: SeedOperation["operation"],
  chargeKobo: number,
  seed: number,
  isZeroDay: boolean,
): SeedOperation {
  const discount = isZeroDay
    ? 0
    : Math.round(chargeKobo * hashSeed(seed + 1) * 0.12);
  const overageRoll = hashSeed(seed + 2);
  const overage =
    !isZeroDay && overageRoll > 0.9
      ? Math.round(chargeKobo * (0.05 + hashSeed(seed + 3) * 0.15))
      : 0;
  const underRecovery =
    !isZeroDay && overage === 0
      ? Math.round(chargeKobo * hashSeed(seed + 4) * 0.05)
      : 0;
  return {
    operation,
    holdKobo: chargeKobo + discount,
    chargeKobo,
    actualKobo: Math.max(0, chargeKobo + overage - underRecovery),
  };
}

export function generateSeedSessions({
  days,
  sessionsPerDay,
  now,
}: GenerateSeedOptions): SeedSession[] {
  const today = new Date(now);
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const sessions: SeedSession[] = [];
  let base = 2500;

  for (let day = 0; day < days; day += 1) {
    const drift = (hashSeed(day * 17 + 101) - 0.5) * 0.3;
    base = Math.min(8000, Math.max(800, Math.round(base * (1 + drift))));

    if (day < days - 10 && day % 19 === 6) continue;

    const isZeroDay = day % 13 === 7;
    const count = Math.max(
      1,
      sessionsPerDay +
        (hashSeed(day * 23 + 7) > 0.75 ? 1 : 0) -
        (hashSeed(day * 23 + 8) < 0.2 ? 1 : 0),
    );
    const dayStart = todayUtc - (days - 1 - day) * DAY_MS;

    for (let slot = 0; slot < count; slot += 1) {
      const seed = day * 1009 + slot * 31 + 17;
      const minuteOffset =
        8 * 60 + Math.round(hashSeed(seed + 5) * 11 * 60);
      const variation = 0.7 + hashSeed(seed + 6) * 0.6;
      const target = isZeroDay
        ? 0
        : Math.max(100, Math.round(base * variation));

      const hasBrowser = !isZeroDay && hashSeed(seed + 7) > 0.7;
      const hasSheet = !isZeroDay && hashSeed(seed + 8) > 0.85;
      const kinds: SeedOperation["operation"][] = ["chat"];
      const weights = [1];
      if (hasBrowser) {
        kinds.push("browser_use");
        weights.push(0.2);
      }
      if (hasSheet) {
        kinds.push("custom_tool");
        weights.push(0.1);
      }
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const operations: SeedOperation[] = [];
      let assigned = 0;
      for (let index = 0; index < kinds.length; index += 1) {
        const chargeKobo =
          index === kinds.length - 1
            ? target - assigned
            : Math.round((target * weights[index]) / totalWeight);
        assigned += chargeKobo;
        operations.push(
          makeOperation(kinds[index], chargeKobo, seed + index * 13, isZeroDay),
        );
      }

      const scenario = isZeroDay
        ? "zero"
        : hasSheet
          ? "spreadsheet"
          : hasBrowser
            ? "browser"
            : day % 11 === 3
              ? "overage"
              : "normal";
      sessions.push({
        threadId: `seed-billing:day-${String(day).padStart(3, "0")}-s${slot + 1}`,
        title: `Demo · ${scenario} · day ${day + 1} · session ${slot + 1}`,
        date: dayStart + minuteOffset * 60_000,
        operations,
      });
    }
  }
  return sessions;
}
