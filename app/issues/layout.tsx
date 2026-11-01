import type { ReactNode } from "react";
import { DashboardAppShell } from "@/components/dashboard-app-shell";

export default function IssuesLayout({ children }: { children: ReactNode }) {
  return <DashboardAppShell>{children}</DashboardAppShell>;
}
