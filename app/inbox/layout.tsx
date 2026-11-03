import type { ReactNode } from "react";
import { DashboardAppShell } from "@/components/dashboard-app-shell";

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <DashboardAppShell>{children}</DashboardAppShell>;
}
