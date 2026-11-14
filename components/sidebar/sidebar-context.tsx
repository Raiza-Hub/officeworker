"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  openDesktop: boolean;
  setOpenDesktop: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  children,
  defaultOpen = true,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [openDesktop, setOpenDesktop] = useState(defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${openDesktop}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  }, [openDesktop]);

  const open = isMobile ? openMobile : openDesktop;

  const setOpen = useCallback(
    (value: boolean) => {
      if (isMobile) {
        setOpenMobile(value);
      } else {
        setOpenDesktop(value);
      }
    },
    [isMobile],
  );

  const toggle = useCallback(() => {
    if (isMobile) {
      setOpenMobile((v) => !v);
    } else {
      setOpenDesktop((v) => !v);
    }
  }, [isMobile]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      isMobile,
      openMobile,
      setOpenMobile,
      openDesktop,
      setOpenDesktop,
    }),
    [open, setOpen, toggle, isMobile, openMobile, openDesktop],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
