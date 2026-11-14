import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { DashboardAppShell } from "@/components/dashboard-app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <DashboardAppShell defaultOpen={defaultOpen}>{children}</DashboardAppShell>
  );
}
