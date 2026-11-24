const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type TopupPlan = "basic" | "pro";

export type InvoicePlanLabel = "Basic" | "Pro";

export type InvoiceData = {
  reference: string;
  amount: number;
  date: number;
  plan: InvoicePlanLabel;
};

export function normalizeTopupPlan(plan?: string | null): TopupPlan {
  return plan === "pro" ? "pro" : "basic";
}

export function getInvoicePlanLabel(plan?: string | null): InvoicePlanLabel {
  return normalizeTopupPlan(plan) === "pro" ? "Pro" : "Basic";
}

export function formatInvoiceDate(timestamp: number) {
  const date = new Date(timestamp + 60 * 60 * 1000);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function formatTransactionDate(timestamp: number) {
  const date = new Date(timestamp + 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

export function formatTransactionDateTime(timestamp: number) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function formatInvoiceAmount(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function formatInvoiceAmountAscii(amount: number) {
  return `NGN ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getInvoiceFileName(reference: string) {
  return `invoice-${reference}.pdf`;
}
