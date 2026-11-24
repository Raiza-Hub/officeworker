#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const email = getArg("email") ?? "wisdomadebola62@gmail.com";
const days = Number(getArg("days") ?? "90");
const sessionsPerDay = Number(getArg("sessions") ?? "3");
const clear = process.argv.includes("--clear");

if (!Number.isFinite(days) || days < 1 || days > 365) {
  console.error("Days must be a number between 1 and 365");
  process.exit(1);
}
if (!Number.isFinite(sessionsPerDay) || sessionsPerDay < 1 || sessionsPerDay > 8) {
  console.error("Sessions must be a number between 1 and 8");
  process.exit(1);
}

const args = JSON.stringify(
  clear
    ? { email, confirm: "CLEAR_SEEDED_BILLING_HISTORY" }
    : { email, days, sessionsPerDay, confirm: "SEED_BILLING_HISTORY" },
);
const cmd = [
  "convex",
  "run",
  clear ? "internal.seedBillingHistory.clear" : "internal.seedBillingHistory.seed",
  args,
];

console.log(
  `${clear ? "Clearing" : "Seeding"} ${days} days of billing history (${sessionsPerDay} sessions/day) for ${email} (dev)...`,
);
const result = spawnSync("bunx", cmd, { stdio: "inherit", cwd: process.cwd() });
process.exit(result.status ?? 1);
