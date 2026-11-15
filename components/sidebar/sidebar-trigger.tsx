"use client";

import { PanelLeft } from "lucide-react";
import { useSidebar } from "@/components/sidebar/sidebar-context";

export function SidebarTrigger() {
  const { open, toggle } = useSidebar();

  return (
    <button
      type="button"
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      aria-expanded={open}
      onClick={toggle}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[#646770] transition-colors hover:bg-surface-hover-soft hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40"
    >
      <PanelLeft aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />
    </button>
  );
}

export function HeaderSidebarTrigger() {
  const { isMobile, openDesktop } = useSidebar();

  if (!isMobile && openDesktop) {
    return null;
  }

  return <SidebarTrigger />;
}
