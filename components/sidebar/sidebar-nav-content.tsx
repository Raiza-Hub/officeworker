"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  CreditCard,
  Files,
  MousePointer2,
  Search,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ChatHistorySection } from "@/components/chat-history/chat-history-section";
import { useSidebar } from "@/components/sidebar/sidebar-context";
import { SidebarLink, sidebarLinkFocusRingClassName } from "@/components/sidebar/sidebar-link";
import { SidebarTrigger } from "@/components/sidebar/sidebar-trigger";

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

const mainItems: SidebarItem[] = [
  { label: "Agent", icon: MousePointer2, href: "/agent" },
  { label: "Documents", icon: Files, href: "/documents" },
];

const workspaceItems: SidebarItem[] = [
  { label: "Profile", icon: UserRound, href: "/profile" },
  { label: "Billings", icon: CreditCard, href: "/billing" },
];

const iconClassName = "size-3.5 shrink-0";
const iconStrokeWidth = 2.25;
const focusRingClassName = sidebarLinkFocusRingClassName;

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function SidebarNavLink({
  item,
  active,
}: {
  item: SidebarItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <SidebarLink href={item.href} active={active} aria-label={item.label}>
      <Icon
        aria-hidden="true"
        className={iconClassName}
        strokeWidth={iconStrokeWidth}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </SidebarLink>
  );
}

export function SidebarNavContent() {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const { isMobile } = useSidebar();
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const currentUser = useQuery(
    api.users.current,
    isAuthenticated ? {} : "skip",
  );
  const displayName =
    currentUser?.name?.trim() || currentUser?.email?.trim() || "Workspace";
  const profileImage = currentUser?.image?.trim() || null;
  const initials = getInitials(displayName);

  return (
    <div className="box-border flex h-full w-[244px] shrink-0 flex-col overflow-hidden bg-sidebar-bg px-3 pt-2 pb-3 text-sidebar-text">
      <div className="flex h-11 items-center gap-2">
        <button
          type="button"
          aria-label="Open workspace menu"
          className={`flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-[10px] px-[5px] pr-[9px] text-left text-sidebar-text transition-colors duration-100 ease-out hover:bg-[#f3f3f4] ${focusRingClassName} motion-reduce:transition-none`}
        >
          <span className="inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-avatar text-[10px] leading-none font-semibold tracking-[-0.02em] text-white">
            {profileImage ? (
              <Image
                src={profileImage}
                alt=""
                width={20}
                height={20}
                className="size-5 object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <span className="truncate text-[13px] leading-[23px] font-[550]">
            {displayName}
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Search"
            title="Search"
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[#646770] transition-colors hover:bg-[#f0f0f2] hover:text-[#303137] ${focusRingClassName}`}
          >
            <Search
              aria-hidden="true"
              className={iconClassName}
              strokeWidth={iconStrokeWidth}
            />
          </button>
          {!isMobile && <SidebarTrigger />}
        </div>
      </div>

      <nav
        aria-label="Dashboard navigation"
        className="mt-2 flex flex-col gap-px"
      >
        {mainItems.map((item) => (
          <SidebarNavLink
            key={item.label}
            item={item}
            active={item.href === pathname || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </nav>

      <div className="mt-4">
        <button
          type="button"
          aria-expanded={settingsExpanded}
          onClick={() => setSettingsExpanded((v) => !v)}
          className={`flex h-7 w-full items-center gap-1 rounded-lg px-[5px] text-left text-[12px] leading-[14px] font-medium text-[#62656d] transition-colors duration-100 ease-out hover:bg-[#f3f3f4] hover:text-sidebar-foreground ${focusRingClassName} motion-reduce:transition-none`}
        >
          <span className="flex-1">Settings</span>
          <ChevronDown
            aria-hidden="true"
            className={`size-3.5 shrink-0 text-[#858890] transition-transform duration-150 ${settingsExpanded ? "" : "-rotate-90"}`}
            strokeWidth={iconStrokeWidth}
          />
        </button>

        {settingsExpanded && (
          <nav
            aria-label="Workspace navigation"
            className="mt-[3px] flex flex-col gap-px"
          >
            {workspaceItems.map((item) => (
              <SidebarNavLink
                key={item.label}
                item={item}
                active={item.href === pathname}
              />
            ))}
          </nav>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ChatHistorySection />
      </div>

      <div className="shrink-0 pt-3">
        <SignOutButton collapsed={false} />
      </div>
    </div>
  );
}
