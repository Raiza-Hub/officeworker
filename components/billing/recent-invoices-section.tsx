"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp + 60 * 60 * 1000);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hour}:${minute} WAT`;
}

export function RecentInvoicesSection() {
  const transactions = useQuery(api.billing.recentTransactions, {});

  return (
    <section aria-labelledby="wallet-activity-heading" className="mt-9 pt-3">
      <h2
        id="wallet-activity-heading"
        className="m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-[#292a30]"
      >
        Recent wallet activity
      </h2>
      <div className="mt-4 overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]">
        {!transactions || transactions.length === 0 ? (
          <div className="flex min-h-[60px] items-center px-4 text-[13px] leading-[15.5px] font-[450] text-[#777a82]">
            No wallet transactions yet
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-[#eeeeef] p-0">
            {transactions.map((transaction) => (
              <li key={transaction._id} className="flex min-h-[60px] items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-medium text-[#292a30]">{transaction.description}</p>
                  <p className="m-0 mt-1 text-[11px] text-[#85878e]">
                    {formatTimestamp(transaction.createdAt)}
                  </p>
                </div>
                <span className={`shrink-0 text-[13px] font-medium ${transaction.amount > 0 ? "text-[#18804b]" : "text-[#292a30]"}`}>
                  {transaction.amount > 0 ? "+" : "−"}₦{Math.abs(transaction.amount).toLocaleString("en-NG")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
