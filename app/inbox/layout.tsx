import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 overflow-hidden bg-app-bg">
      <DashboardSidebar />
      <main className="min-w-0 flex-1 bg-app-bg">{children}</main>
    </div>
  );
}
