"use client";

import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import SlideCommit from "@/components/ui/slide-commit";

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

export function WalletBalance() {
  const wallet = useQuery(api.billing.currentWallet, {});
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState("5000");
  const [error, setError] = useState<string | null>(null);
  const pendingUrl = useRef<string | null>(null);

  async function startCheckout() {
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 3000 || value > 1_000_000) {
      const message = "Enter an amount between ₦3,000 and ₦1,000,000.";
      setError(message);
      throw new Error(message);
    }

    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value }),
    });
    const result = (await response.json()) as {
      checkoutUrl?: string;
      error?: string;
    };
    if (!response.ok || !result.checkoutUrl) {
      const message = result.error ?? "Could not open Korapay checkout.";
      setError(message);
      throw new Error(message);
    }
    pendingUrl.current = result.checkoutUrl;
  }

  function handleDone() {
    if (pendingUrl.current) {
      window.location.assign(pendingUrl.current);
    }
  }

  function handleError(reason: unknown) {
    setError(
      reason instanceof Error
        ? reason.message
        : "Could not open Korapay checkout.",
    );
  }

  return (
    <section aria-label="Wallet balance" className="mt-8 px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[15px] leading-[23px] font-medium text-ink-soft">
            Wallet balance
          </h2>
          <div className="mt-1 min-h-8">
            {wallet ? (
              <p className="m-0 text-[32px] leading-none font-medium tabular-nums tracking-tight text-ink">
                {naira(wallet.balanceKobo / 100)}
              </p>
            ) : (
              <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAdding((open) => !open);
            setError(null);
          }}
          className="inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs leading-none font-medium text-ink-soft transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {isAdding ? "Close" : "Add credits"}
        </button>
      </div>

      {isAdding && (
        <div className="mt-3 pt-3">
          <label
            htmlFor="wallet-topup-amount"
            className="block text-xs font-medium text-text-secondary"
          >
            Amount to add (min ₦3,000)
          </label>
          <div className="mt-2.5 flex items-center gap-2">
            <input
              id="wallet-topup-amount"
              type="number"
              min={3000}
              max={1_000_000}
              step={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-border-muted px-2.5 text-[13px] text-ink-soft outline-none focus:border-primary-ring focus:ring-2 focus:ring-primary/20"
            />
            <SlideCommit
              label="Slide to pay"
              doneLabel="Redirecting…"
              errorLabel="Payment failed"
              trackColor="#626bd9"
              width={200}
              height={36}
              onConfirm={startCheckout}
              onDone={handleDone}
              onError={handleError}
              className="shrink-0"
            />
          </div>
          {error && (
            <p role="alert" className="mt-2 mb-0 text-xs text-danger-text">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
