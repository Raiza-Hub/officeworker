#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const prod = process.argv.includes("--prod");
const email = getArg("email") ?? "wisdomadebola62@gmail.com";
const amount = Number(getArg("amount") ?? "2000");
const description = getArg("description") ?? "Manual wallet credit";
const reference = getArg("reference");

if (!Number.isFinite(amount) || amount <= 0) {
  console.error("Amount must be a positive number");
  process.exit(1);
}

const args = JSON.stringify({
  email,
  amount,
  description,
  ...(reference ? { reference } : {}),
});

const cmd = ["convex", "run", "internal.billing.adminCreditWallet", args];
if (prod) cmd.push("--prod");

console.log(
  `Crediting ₦${amount.toLocaleString("en-NG")} to ${email}${prod ? " (prod)" : " (dev)"}...`,
);
const result = spawnSync("bunx", cmd, { stdio: "inherit", cwd: process.cwd() });
process.exit(result.status ?? 1);
