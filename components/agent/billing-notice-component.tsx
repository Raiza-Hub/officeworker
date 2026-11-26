"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Pencil, X } from "lucide-react";
import { m } from "motion/react";
import type { BillingNoticeData } from "./billing-notice-utils";

export function BillingNotice({
  notice,
  onDismiss,
  dismissLabel = "Dismiss billing notice",
}: {
  notice: BillingNoticeData;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const Icon = notice.code === "EDITING" ? Pencil : AlertCircle;
  return (
    <m.div
      role="alert"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="relative z-0 -mb-3 flex w-full items-center justify-between gap-3 rounded-t-[11px] border-x border-t border-border bg-secondary px-3 pt-2 pb-5 text-[12.5px] leading-4"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          aria-hidden="true"
          className={
            notice.code === "EDITING"
              ? "size-3.5 shrink-0 text-text-dim"
              : "size-3.5 shrink-0 text-[#d9383a]"
          }
        />
        <span className="truncate text-[12.5px] leading-4 text-text-dim">
          {notice.message}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {notice.href && notice.actionLabel && (
          <Link
            href={notice.href}
            className="group inline-flex items-center gap-1 text-[12.5px] leading-4 font-medium text-ink transition-colors hover:text-primary"
          >
            <span>{notice.actionLabel}</span>
            <ArrowRight
              aria-hidden="true"
              className="size-3 text-text-tertiary transition-colors group-hover:text-primary"
            />
          </Link>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="-my-0.5 -mr-0.5 inline-flex size-5 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <X aria-hidden="true" className="size-3.5" strokeWidth={1.85} />
          </button>
        )}
      </div>
    </m.div>
  );
}
