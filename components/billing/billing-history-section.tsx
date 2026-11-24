"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { LoaderCircle } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useConvexAuth } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { BillingHistoryRowActions } from "@/components/billing/billing-history-row-actions";
import { Badge } from "@/components/ui/badge";
import {
  formatInvoiceAmountAscii,
  formatTransactionDate,
  formatTransactionDateTime,
  getInvoicePlanLabel,
} from "@/lib/invoice";

const PAGE_SIZE = 10;

const historyListClassName =
  "m-0 list-none divide-y divide-border-soft p-0";

const rowClassName =
  "grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_96px_128px_28px] items-center gap-3 px-4 py-3";

const reportRowClassName =
  "grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_96px_128px] items-center gap-3 px-4 py-3";

export function BillingHistorySection() {
  const { isAuthenticated } = useConvexAuth();
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<"invoices" | "reports">("invoices");
  const {
    results: transactions,
    status: invoiceStatus,
    loadMore: loadMoreInvoices,
  } = usePaginatedQuery(
    api.billing.invoiceHistory,
    isAuthenticated ? {} : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const {
    results: reports,
    status: reportStatus,
    loadMore: loadMoreReports,
  } = usePaginatedQuery(
    api.paymentReports.listMine,
    isAuthenticated ? {} : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const activeStatus = view === "reports" ? reportStatus : invoiceStatus;
  const activeLoadMore =
    view === "reports" ? loadMoreReports : loadMoreInvoices;
  const isLoading = invoiceStatus === "LoadingFirstPage";
  const isLoadingReports = reportStatus === "LoadingFirstPage";

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || activeStatus !== "CanLoadMore") return;
    const root = sentinel.closest<HTMLElement>("[data-billing-scroll]");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activeLoadMore(PAGE_SIZE);
        }
      },
      { root, rootMargin: "160px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeLoadMore, activeStatus, view]);

  function handleToggleView() {
    setView((current) => (current === "reports" ? "invoices" : "reports"));
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="billing-history-heading"
      className="mt-9 scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border-soft px-4 pb-2">
        <h2
          id="billing-history-heading"
          className="m-0 text-[15px] leading-[23px] font-medium text-ink-soft"
        >
          Billing history
        </h2>
        <button
          aria-label={view === "reports" ? "Show invoices" : "Show reports"}
          aria-pressed={view === "reports"}
          className="inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs leading-none font-medium text-ink-soft transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={handleToggleView}
          type="button"
        >
          {view === "reports" ? "Invoices" : "Reports"}
        </button>
      </div>
      {view === "reports" ? (
        isLoadingReports ? (
          <ul className={historyListClassName}>
            {Array.from({ length: 3 }).map((_, index) => (
              <li className={reportRowClassName} key={index}>
                <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
                <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
                <div className="h-5 w-11 animate-pulse rounded-full bg-secondary" />
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-secondary" />
              </li>
            ))}
          </ul>
        ) : reports.length === 0 ? (
          <div className="flex min-h-16 items-center px-4 text-[13px] leading-[15.5px] font-[450] text-text-tertiary">
            No reports yet
          </div>
        ) : (
          <>
            <ul className={historyListClassName}>
              {reports.map((report) => {
                const reportDate =
                  report.status === "open" ? report.createdAt : report.updatedAt;
                const dateLabel =
                  report.status === "open" ? "Created" : "Updated";
                return (
                  <li className={reportRowClassName} key={report._id}>
                    <span
                      className="truncate text-[14px] leading-5 font-[450] text-ink-soft"
                      title={report._id}
                    >
                      Report {report._id.slice(-6)}
                    </span>
                    <span className="text-[13px] leading-5 text-text-tertiary">
                      {getInvoicePlanLabel(report.plan)} plan
                    </span>
                    <Badge
                      className={cn(
                        "justify-self-start",
                        report.status === "resolved" &&
                          "bg-success-bg text-success-text",
                      )}
                      variant="secondary"
                    >
                      {report.status === "open" ? "Open" : "Resolved"}
                    </Badge>
                    <div className="text-right">
                      <span className="block text-[14px] leading-5 font-medium tabular-nums text-ink">
                        {formatInvoiceAmountAscii(report.amount)}
                      </span>
                      <time
                        className="block text-[12px] leading-4 text-text-tertiary tabular-nums"
                        dateTime={formatTransactionDateTime(reportDate)}
                      >
                        {dateLabel} {formatTransactionDate(reportDate)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
            {reportStatus === "LoadingMore" && (
              <div className="flex items-center justify-center py-3">
                <LoaderCircle
                  aria-label="Loading more reports"
                  className="size-4 animate-spin text-muted-foreground"
                  strokeWidth={2}
                />
              </div>
            )}
            <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
          </>
        )
      ) : isLoading ? (
        <ul className={historyListClassName}>
          {Array.from({ length: 3 }).map((_, index) => (
            <li className={rowClassName} key={index}>
              <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
              <div className="h-5 w-11 animate-pulse rounded-full bg-secondary" />
              <div className="ml-auto h-4 w-20 animate-pulse rounded bg-secondary" />
              <div className="size-7 animate-pulse rounded-full bg-secondary" />
            </li>
          ))}
        </ul>
      ) : transactions.length === 0 ? (
        <div className="flex min-h-16 items-center px-4 text-[13px] leading-[15.5px] font-[450] text-text-tertiary">
          No billing history yet
        </div>
      ) : (
        <>
          <ul className={historyListClassName}>
            {transactions.map((transaction) => (
              <li className={rowClassName} key={transaction._id}>
                <span className="truncate text-[14px] leading-5 font-[450] text-ink-soft">
                  {getInvoicePlanLabel(transaction.plan)} plan
                </span>
                <time
                  className="text-[13px] leading-5 text-text-tertiary tabular-nums"
                  dateTime={formatTransactionDateTime(transaction.date)}
                >
                  {formatTransactionDate(transaction.date)}
                </time>
                <Badge
                  className={cn(
                    "justify-self-start",
                    transaction.status === "paid"
                      ? "bg-success-bg text-success-text"
                      : "bg-danger-bg text-danger-text",
                  )}
                  variant="secondary"
                >
                  {transaction.status === "paid" ? "Paid" : "Failed"}
                </Badge>
                <span className="text-right text-[14px] leading-5 font-medium tabular-nums text-ink">
                  {formatInvoiceAmountAscii(transaction.amount)}
                </span>
                <BillingHistoryRowActions
                  intentId={transaction._id}
                  reference={transaction.reference}
                />
              </li>
            ))}
          </ul>
          {invoiceStatus === "LoadingMore" && (
            <div className="flex items-center justify-center py-3">
              <LoaderCircle
                aria-label="Loading more invoices"
                className="size-4 animate-spin text-muted-foreground"
                strokeWidth={2}
              />
            </div>
          )}
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
        </>
      )}
    </section>
  );
}
