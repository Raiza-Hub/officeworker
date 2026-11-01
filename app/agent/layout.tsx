import type { ReactNode } from "react";
import { DashboardAppShell } from "@/components/dashboard-app-shell";

export default function AgentLayout({ children }: { children: ReactNode }) {
  return <DashboardAppShell>{children}</DashboardAppShell>;
}
