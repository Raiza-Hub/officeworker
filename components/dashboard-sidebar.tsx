"use client";

import { useEffect, useRef, useState } from "react";
import { SidebarNavContent } from "@/components/sidebar/sidebar-nav-content";
import { useSidebar } from "@/components/sidebar/sidebar-context";
import { useLockBodyScroll } from "@/components/sidebar/use-lock-body-scroll";
import { useMobileSidebarFocus } from "@/components/sidebar/use-mobile-sidebar-focus";

export function DashboardSidebar() {
  const { isMobile, openMobile, setOpenMobile, openDesktop } = useSidebar();
  const sidebarRef = useRef<HTMLElement>(null);
  const [enteringDesktop, setEnteringDesktop] = useState(false);
  const [enteringMobile, setEnteringMobile] = useState(false);
  const prevIsMobileRef = useRef(isMobile);

  useEffect(() => {
    if (prevIsMobileRef.current === isMobile) return;
    const wasMobile = prevIsMobileRef.current;
    prevIsMobileRef.current = isMobile;
    let frame1 = 0;
    let frame2 = 0;
    frame1 = requestAnimationFrame(() => {
      if (wasMobile && !isMobile) {
        if (openDesktop) setEnteringDesktop(true);
      } else if (!wasMobile && isMobile) {
        setEnteringMobile(true);
      }
      frame2 = requestAnimationFrame(() => {
        setEnteringDesktop(false);
        setEnteringMobile(false);
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [isMobile, openDesktop]);

  useLockBodyScroll(isMobile && openMobile);
  useMobileSidebarFocus(
    sidebarRef,
    isMobile && openMobile,
    () => setOpenMobile(false),
  );

  const renderDesktopOpen = enteringDesktop ? false : openDesktop;
  const renderMobileOpen = enteringMobile ? false : openMobile;
  const mobileOpen = isMobile && renderMobileOpen;
  const ease = "ease-[cubic-bezier(0.16,1,0.3,1)]";

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${ease} motion-reduce:transition-none ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (isMobile && openMobile) setOpenMobile(false);
        }}
      />
      <aside
        id="dashboard-sidebar"
        ref={sidebarRef}
        aria-label="Dashboard sidebar"
        aria-hidden={isMobile && !renderMobileOpen ? true : undefined}
        aria-modal={isMobile && openMobile ? true : undefined}
        role={isMobile && openMobile ? "dialog" : undefined}
        tabIndex={-1}
        className={
          isMobile
            ? `fixed inset-y-0 left-0 z-50 h-full w-[244px] shrink-0 overflow-hidden bg-sidebar-bg transition-transform duration-300 ${ease} motion-reduce:transition-none ${
                renderMobileOpen
                  ? "pointer-events-auto translate-x-0 shadow-xl"
                  : "pointer-events-none -translate-x-full"
              }`
            : `hidden h-full shrink-0 overflow-hidden bg-sidebar-bg transition-[width] duration-300 ${ease} motion-reduce:transition-none md:block ${
                renderDesktopOpen ? "w-[244px]" : "w-0"
              }`
        }
      >
        <SidebarNavContent />
      </aside>
    </>
  );
}
