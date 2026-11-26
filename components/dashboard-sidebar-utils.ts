export function overlayClassName(mobileOpen: boolean, ease: string) {
  return `fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${ease} motion-reduce:transition-none ${
    mobileOpen
      ? "pointer-events-auto opacity-100"
      : "pointer-events-none opacity-0"
  }`;
}

export function sidebarClassName({
  isMobile,
  renderMobileOpen,
  renderDesktopOpen,
  ease,
}: {
  isMobile: boolean;
  renderMobileOpen: boolean;
  renderDesktopOpen: boolean;
  ease: string;
}) {
  if (isMobile) {
    return `fixed inset-y-0 left-0 z-50 h-full w-61 shrink-0 overflow-hidden bg-sidebar-bg transition-transform duration-300 ${ease} motion-reduce:transition-none ${
      renderMobileOpen
        ? "pointer-events-auto translate-x-0 shadow-xl"
        : "pointer-events-none -translate-x-full"
    }`;
  }
  return `hidden h-full shrink-0 overflow-hidden bg-sidebar-bg transition-[width] duration-300 ${ease} motion-reduce:transition-none lg:block ${
    renderDesktopOpen ? "w-61" : "w-0"
  }`;
}
