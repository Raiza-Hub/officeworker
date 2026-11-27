export type BillingNoticeCode =
  | "WALLET_EMPTY"
  | "INSUFFICIENT_CREDITS"
  | "PLAN_UPGRADE_REQUIRED";

export type BillingNoticeData = {
  code: BillingNoticeCode | "EDITING";
  message: string;
  highlight?: string;
  actionLabel?: string;
  href?: string;
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
