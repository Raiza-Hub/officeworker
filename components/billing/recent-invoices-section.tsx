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
  return `${day} ${month} ${year}`;
}

export function RecentInvoicesSection() {
  const invoices = useQuery(api.billing.recentInvoices, {});

  return (
    <section aria-labelledby="billing-history-heading" className="mt-9 pt-3">
      <h2
        id="billing-history-heading"
        className="m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-ink-soft"
      >
        Billing history
      </h2>
      <div className="mt-4 overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]">
        {!invoices || invoices.length === 0 ? (
          <div className="flex min-h-15 items-center px-4 text-[13px] leading-[15.5px] font-[450] text-text-tertiary">
            No billing history yet
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-border-soft p-0">
            {invoices.map((invoice) => (
              <li key={invoice._id} className="flex min-h-15 items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[15px] leading-6 font-medium text-ink-soft">
                    ₦{invoice.amount.toLocaleString("en-NG")}
                  </p>
                  <p className="m-0 mt-1 text-xs leading-[14.5px] font-[450] text-text-tertiary">
                    {formatTimestamp(invoice.createdAt)} · {invoice.paymentMethod}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs leading-none font-medium ${invoice.status === "Successful" ? "text-[#18804b]" : "text-danger-text"}`}
                >
                  {invoice.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
