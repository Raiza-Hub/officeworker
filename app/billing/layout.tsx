import type { ReactNode } from "react";
import { DashboardAppShell } from "@/components/dashboard-app-shell";

export default function BillingLayout({ children }: { children: ReactNode }) {
  return <DashboardAppShell>{children}</DashboardAppShell>;
}
