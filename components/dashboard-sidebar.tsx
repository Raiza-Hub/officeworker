"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  CircleDot,
  CircleHelp,
  CreditCard,
  GitPullRequest,
  Inbox,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UserRound,
} from "lucide-react";

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  unread?: boolean;
};

const mainItems: SidebarItem[] = [
  { label: "Inbox", icon: Inbox, href: "/inbox" },
  { label: "Reviews", icon: GitPullRequest, unread: true },
  { label: "My issues", icon: CircleDot, href: "/issues" },
  { label: "Agent", icon: MousePointer2, href: "/agent" },
];

const workspaceItems: SidebarItem[] = [
  { label: "Profile", icon: UserRound, href: "/profile" },
  { label: "Billings", icon: CreditCard, href: "/billing" },
];

const iconClassName = "size-3.5 shrink-0";
const iconStrokeWidth = 2.25;
const focusRingClassName =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40";

function SidebarItemButton({
  item,
  collapsed,
  active,
}: {
  item: SidebarItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  const className = `relative box-border flex h-7 w-full items-center rounded-lg text-left text-[13px] leading-[15.5px] font-medium tracking-normal transition-colors duration-100 ease-out ${focusRingClassName} motion-reduce:transition-none ${
    collapsed ? "justify-center px-0" : "gap-1.5 px-2"
  } ${
    active
      ? "bg-sidebar-active text-sidebar-foreground"
      : "text-sidebar-muted hover:bg-[#f3f3f4] hover:text-sidebar-foreground"
  }`;
  const controlProps = {
    "aria-label": item.label,
    "aria-current": active ? ("page" as const) : undefined,
    title: collapsed ? item.label : undefined,
    className,
  };
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={iconClassName}
        strokeWidth={iconStrokeWidth}
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {item.unread && (
        <span
          aria-hidden="true"
          className={`rounded-full bg-sidebar-unread ${
            collapsed
              ? "absolute top-1.5 right-1.5 size-1.5"
              : "ml-auto size-2"
          }`}
        />
      )}
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} {...controlProps}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" {...controlProps}>
      {content}
    </button>
  );
}

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      aria-label="Dashboard sidebar"
      className={`box-border flex h-svh shrink-0 flex-col overflow-y-auto bg-sidebar-bg pt-2 pb-3 text-sidebar-text transition-[width] duration-[140ms] ease-in-out motion-reduce:transition-none ${
        collapsed ? "w-16 px-2" : "w-[244px] px-3"
      }`}
    >
      <div
        className={`flex ${
          collapsed
            ? "flex-col items-center gap-1"
            : "h-11 items-center gap-2"
        }`}
      >
        <button
          type="button"
          aria-label="Open workspace menu"
          title={collapsed ? "wisdom Adebola" : undefined}
          className={`flex h-7 min-w-0 items-center rounded-[10px] text-left text-sidebar-text transition-colors duration-100 ease-out hover:bg-[#f3f3f4] ${focusRingClassName} motion-reduce:transition-none ${
            collapsed
              ? "w-7 justify-center px-0"
              : "flex-1 gap-1.5 px-[5px] pr-[9px]"
          }`}
        >
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sidebar-avatar text-[10px] leading-none font-semibold tracking-[-0.02em] text-white">
            WA
          </span>
          {!collapsed && (
            <>
              <span className="truncate text-[13px] leading-[23px] font-[550]">
                wisdom Adebola
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-2 shrink-0 text-[#858890]"
                strokeWidth={iconStrokeWidth}
              />
            </>
          )}
        </button>

        <button
          type="button"
          aria-label="Search"
          title="Search"
          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[#73767e] transition-colors duration-100 ease-out hover:bg-[#f3f3f4] hover:text-[#34363c] ${focusRingClassName} motion-reduce:transition-none`}
        >
          <Search
            aria-hidden="true"
            className={iconClassName}
            strokeWidth={iconStrokeWidth}
          />
        </button>
      </div>

      <nav
        aria-label="Dashboard navigation"
        className="mt-2 flex flex-col gap-px"
      >
        {mainItems.map((item) => (
          <SidebarItemButton
            key={item.label}
            item={item}
            collapsed={collapsed}
            active={item.href === pathname}
          />
        ))}
      </nav>

      <div className="mt-4">
        {!collapsed && (
          <button
            type="button"
            aria-expanded="true"
            className={`flex h-7 w-full items-center gap-1 rounded-lg px-[5px] text-left text-[12px] leading-[14px] font-medium text-[#62656d] transition-colors duration-100 ease-out hover:bg-[#f3f3f4] hover:text-sidebar-foreground ${focusRingClassName} motion-reduce:transition-none`}
          >
            <span className="flex-1">Settings</span>
            <ChevronDown
              aria-hidden="true"
              className={`${iconClassName} text-[#858890]`}
              strokeWidth={iconStrokeWidth}
            />
          </button>
        )}

        <nav
          aria-label="Workspace navigation"
          className={`${collapsed ? "" : "mt-[3px]"} flex flex-col gap-px`}
        >
          {workspaceItems.map((item) => (
            <SidebarItemButton
              key={item.label}
              item={item}
              collapsed={collapsed}
              active={item.href === pathname}
            />
          ))}
        </nav>
      </div>

      <div
        className={`mt-auto pt-4 ${
          collapsed
            ? "flex flex-col items-center gap-2"
            : "flex items-center justify-between"
        }`}
      >
        <button
          type="button"
          aria-label="Help"
          title="Help"
          className={`inline-flex size-7 items-center justify-center rounded-full border border-[#e7e7ea] text-[#4f525a] transition-colors duration-100 ease-out hover:bg-[#f3f3f4] hover:text-sidebar-foreground ${focusRingClassName} motion-reduce:transition-none`}
        >
          <CircleHelp
            aria-hidden="true"
            className={iconClassName}
            strokeWidth={iconStrokeWidth}
          />
        </button>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className={`inline-flex size-7 items-center justify-center rounded-full text-[#4f525a] transition-colors duration-100 ease-out hover:bg-[#f3f3f4] hover:text-sidebar-foreground ${focusRingClassName} motion-reduce:transition-none`}
        >
          {collapsed ? (
            <PanelLeftOpen
              aria-hidden="true"
              className={iconClassName}
              strokeWidth={iconStrokeWidth}
            />
          ) : (
            <PanelLeftClose
              aria-hidden="true"
              className={iconClassName}
              strokeWidth={iconStrokeWidth}
            />
          )}
        </button>
      </div>
    </aside>
  );
}
