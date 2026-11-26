"use client";

import { useEffect, useRef, useState } from "react";
import { SidebarNavContent } from "@/components/sidebar/sidebar-nav-content";
import { useSidebar } from "@/components/sidebar/sidebar-context";
import { useLockBodyScroll } from "@/components/sidebar/use-lock-body-scroll";
import { useMobileSidebarFocus } from "@/components/sidebar/use-mobile-sidebar-focus";
import {
  overlayClassName,
  sidebarClassName,
} from "./dashboard-sidebar-utils";

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
        className={overlayClassName(mobileOpen, ease)}
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
        className={sidebarClassName({
          isMobile,
          renderMobileOpen,
          renderDesktopOpen,
          ease,
        })}
      >
        <SidebarNavContent />
      </aside>
    </>
  );
}
