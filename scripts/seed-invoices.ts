#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const email = getArg("email") ?? "wisdomadebola62@gmail.com";
const count = Number(getArg("count") ?? "60");
const clear = process.argv.includes("--clear");

if (!Number.isFinite(count) || count < 1 || count > 200) {
  console.error("Count must be a number between 1 and 200");
  process.exit(1);
}

const args = JSON.stringify(
  clear
    ? { email, confirm: "CLEAR_SEEDED_INVOICES" }
    : { email, count, confirm: "SEED_INVOICES" },
);
const cmd = [
  "convex",
  "run",
  clear ? "internal.seedInvoices.clear" : "internal.seedInvoices.seed",
  args,
];

console.log(
  `${clear ? "Clearing" : "Seeding"} ${count} fake invoices for ${email} (dev)...`,
);
const result = spawnSync("bunx", cmd, { stdio: "inherit", cwd: process.cwd() });
process.exit(result.status ?? 1);
