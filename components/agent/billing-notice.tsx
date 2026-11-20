"use client";

import Link from "next/link";

export type BillingNoticeCode =
  | "WALLET_EMPTY"
  | "INSUFFICIENT_CREDITS"
  | "PLAN_UPGRADE_REQUIRED";

export type BillingNoticeData = {
  code: BillingNoticeCode;
  message: string;
  actionLabel: string;
  href: string;
};

export function billingNoticeForError(
  data: unknown,
): BillingNoticeData | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as {
    code?: unknown;
    context?: unknown;
    message?: unknown;
  };
  const code = record.code;
  if (code === "WALLET_EMPTY") {
    const context = record.context === "start" ? "start" : "continue";
    return {
      code,
      message:
        typeof record.message === "string"
          ? record.message
          : context === "start"
            ? "You’re out of credits. Add credits to start a chat."
            : "You’ve run out of credits. Add credits to continue this chat.",
      actionLabel: "Add credits",
      href: "/billing",
    };
  }
  if (code === "INSUFFICIENT_CREDITS") {
    return {
      code,
      message:
        typeof record.message === "string"
          ? record.message
          : "You don’t have enough credits to complete this request. Add more credits to continue.",
      actionLabel: "Add credits",
      href: "/billing",
    };
  }
  if (code === "PLAN_UPGRADE_REQUIRED") {
    return {
      code,
      message:
        typeof record.message === "string"
          ? record.message
          : "This action requires the Pro plan. Upgrade to Pro to continue.",
      actionLabel: "Upgrade plan",
      href: "/billing",
    };
  }
  return null;
}

export function BillingNotice({ notice }: { notice: BillingNoticeData }) {
  return (
    <div
      role="alert"
      className="mb-3 flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-[#f3f4f5] px-3 py-2.5 text-[13px]"
    >
      <span className="text-danger-text">{notice.message}</span>
      <Link
        href={notice.href}
        className="shrink-0 font-semibold text-danger-text underline underline-offset-2 hover:opacity-80"
      >
        {notice.actionLabel}
      </Link>
    </div>
  );
}
