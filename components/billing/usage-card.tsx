"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

export function UsageCard() {
  const wallet = useQuery(api.billing.currentWallet, {});
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState("5000");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const result = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error ?? "Could not open Korapay checkout.");
      }
      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not open checkout.");
      setIsLoading(false);
    }
  }

  return (
    <section
      aria-label="Wallet balance"
      className="w-full rounded-[10px] bg-white px-4 py-3 shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]"
    >
      <div className="flex min-h-[41px] items-center justify-between gap-4 pr-2">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h2 className="m-0 text-[13px] leading-[15.5px] font-medium text-[#292a30]">
            Wallet balance
          </h2>
          <p className="m-0 text-[12px] leading-[14.5px] font-[450] text-[#777a82]">
            {wallet ? `${naira(wallet.available)} available` : "Loading balance…"}
            {wallet && wallet.reserved > 0 ? ` · ${naira(wallet.reserved)} reserved for uploads` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAdding((open) => !open);
            setError(null);
          }}
          className="inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] leading-none font-medium text-[#292a30] transition-colors hover:bg-[#f2f2f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
        >
          {isAdding ? "Close" : "Add credits"}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={startCheckout} className="mt-3 border-t border-[#efeff1] pt-3">
          <label htmlFor="wallet-topup-amount" className="block text-[12px] font-medium text-[#45474e]">
            Amount to add (₦500–₦1,000,000)
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="wallet-topup-amount"
              type="number"
              min={500}
              max={1_000_000}
              step={100}
              required
              value={amount}
              onChange={(inputEvent) => setAmount(inputEvent.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-[#e4e4e7] px-2.5 text-[13px] text-[#292a30] outline-none focus:border-[#858cec] focus:ring-2 focus:ring-[#626bd9]/20"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="h-9 shrink-0 rounded-md bg-[lch(53%_52.26_286.91)] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[#626bd9] disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading ? "Opening…" : "Continue to Korapay"}
            </button>
          </div>
          {error && <p role="alert" className="mb-0 mt-2 text-[12px] text-[#b42318]">{error}</p>}
        </form>
      )}
    </section>
  );
}
