"use client";

import type { RefObject } from "react";
import { cn } from "cn";
import { LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BillingHistoryRowActions } from "@/components/billing/billing-history-row-actions";
import {
  formatInvoiceAmountAscii,
  formatTransactionDate,
  formatTransactionDateTime,
  getInvoicePlanLabel,
} from "@/lib/invoice";
import type {
  BillingReport,
  BillingTransaction,
} from "@/hooks/use-billing-history";

export function ReportSkeletonRows() {
  return (
    <ul className="m-0 list-none divide-y divide-border-soft p-0">
      {Array.from({ length: 3 }).map((_, index) => (
        <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_96px_128px] items-center gap-3 px-4 py-3" key={index}>
          <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
          <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
          <div className="h-5 w-11 animate-pulse rounded-full bg-secondary" />
          <div className="ml-auto h-4 w-20 animate-pulse rounded bg-secondary" />
        </li>
      ))}
    </ul>
  );
}

export function InvoiceSkeletonRows() {
  return (
    <ul className="m-0 list-none divide-y divide-border-soft p-0">
      {Array.from({ length: 3 }).map((_, index) => (
        <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_96px_128px_28px] items-center gap-3 px-4 py-3" key={index}>
          <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
          <div className="h-4 w-16 animate-pulse rounded bg-secondary" />
          <div className="h-5 w-11 animate-pulse rounded-full bg-secondary" />
          <div className="ml-auto h-4 w-20 animate-pulse rounded bg-secondary" />
          <div className="size-7 animate-pulse rounded-full bg-secondary" />
        </li>
      ))}
    </ul>
  );
}

export function ReportRow({ report }: { report: BillingReport }) {
  const reportDate =
    report.status === "open" ? report.createdAt : report.updatedAt;
  const dateLabel = report.status === "open" ? "Created" : "Updated";
  return (
    <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_96px_128px] items-center gap-3 px-4 py-3" key={report._id}>
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
}

export function InvoiceRow({
  transaction,
}: {
  transaction: BillingTransaction;
}) {
  return (
    <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_96px_128px_28px] items-center gap-3 px-4 py-3" key={transaction._id}>
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
  );
}

export function ReportsHistoryView({
  reports,
  status,
  isLoading,
  sentinelRef,
}: {
  reports: BillingReport[];
  status: string;
  isLoading: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
}) {
  return isLoading ? (
    <ReportSkeletonRows />
  ) : reports.length === 0 ? (
    <div className="flex min-h-16 items-center px-4 text-[13px] leading-[15.5px] font-[450] text-text-tertiary">
      No reports yet
    </div>
  ) : (
    <>
      <ul className="m-0 list-none divide-y divide-border-soft p-0">
        {reports.map((report) => (
          <ReportRow key={report._id} report={report} />
        ))}
      </ul>
      {status === "LoadingMore" && (
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
  );
}

export function InvoicesHistoryView({
  transactions,
  status,
  isLoading,
  sentinelRef,
}: {
  transactions: BillingTransaction[];
  status: string;
  isLoading: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
}) {
  return isLoading ? (
    <InvoiceSkeletonRows />
  ) : transactions.length === 0 ? (
    <div className="flex min-h-16 items-center px-4 text-[13px] leading-[15.5px] font-[450] text-text-tertiary">
      No billing history yet
    </div>
  ) : (
    <>
      <ul className="m-0 list-none divide-y divide-border-soft p-0">
        {transactions.map((transaction) => (
          <InvoiceRow key={transaction._id} transaction={transaction} />
        ))}
      </ul>
      {status === "LoadingMore" && (
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
  );
}
