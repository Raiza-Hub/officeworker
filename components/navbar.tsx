"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const headerRef = useRef<HTMLElement>(null);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (
    pathname === "/login" ||
    pathname === "/create-workspace" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/inbox") ||
    pathname.startsWith("/agent") ||
    pathname.startsWith("/issues") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/billing")
  ) {
    return null;
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-white transition-[background-color,backdrop-filter,box-shadow] duration-200 ease-out data-[scrolled=true]:bg-white/60 data-[scrolled=true]:backdrop-blur-[20px] data-[scrolled=true]:backdrop-saturate-[180%] data-[scrolled=true]:shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.04)] [@media(prefers-reduced-transparency:reduce)]:data-[scrolled=true]:bg-white [@media(prefers-reduced-transparency:reduce)]:data-[scrolled=true]:backdrop-blur-none motion-reduce:transition-none"
      data-scrolled={scrolled ? "true" : "false"}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6"
      >
        <Logo />

        <div className="ml-2 hidden items-center gap-2 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-[14px] font-medium text-black transition-[color,transform] duration-150 ease-out hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:scale-95"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-[14px] font-medium text-black transition-[color,transform] duration-150 ease-out hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:scale-95"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-full bg-black px-4 text-[13px] font-medium text-white transition-[background-color,transform] duration-100 ease-out hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 active:scale-[0.96]"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="navbar-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-black transition-[background-color,transform] duration-100 ease-out hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:scale-90 md:hidden"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>

      <div
        id="navbar-menu"
        className={`mx-4 mb-4 origin-top flex flex-col gap-1 rounded-2xl bg-white/80 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl transition-[opacity,transform] duration-150 ease-out [@media(prefers-reduced-transparency:reduce)]:bg-white [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none motion-reduce:transition-opacity motion-reduce:duration-150 motion-reduce:transform-none md:hidden ${
          open
            ? "pointer-events-auto opacity-100 translate-y-0 scale-100"
            : "pointer-events-none opacity-0 -translate-y-1 scale-[0.96]"
        }`}
      >
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-full bg-black text-[13px] font-medium text-white transition-transform duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:scale-[0.97]"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-full bg-black/[0.05] text-[14px] font-medium text-black transition-[background-color,transform] duration-100 ease-out hover:bg-black/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:scale-[0.97]"
        >
          Log in
        </Link>
        <div className="my-1 h-px bg-black/[0.06]" aria-hidden />
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-3 text-[14px] font-medium text-black transition-colors duration-150 hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
