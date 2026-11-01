import type { Metadata } from "next";
import { BillingPage } from "@/components/billing/billing-page";

export const metadata: Metadata = {
  title: "Billing | Officeworker",
};

export default function Page() {
  return <BillingPage />;
}
