import type { ReactNode } from "react";
import { AgentStatusBar } from "@/components/agent/agent-status-bar";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export function DashboardAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex overflow-hidden bg-sidebar-bg">
      <DashboardSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-sidebar-bg">
        <main className="mt-2 mr-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-[#e9e9ec] bg-agent-page-bg shadow-[0_0.5px_1px_rgba(0,0,0,0.03)]">
          {children}
        </main>
        <AgentStatusBar />
      </div>
    </div>
  );
}
