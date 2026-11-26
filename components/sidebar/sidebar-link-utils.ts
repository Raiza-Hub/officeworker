export const sidebarLinkFocusRingClassName =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40";

export const sidebarLinkBaseClassName =
  `relative box-border flex h-7 w-full items-center gap-1.5 rounded-lg px-2 text-left text-[13px] leading-[15.5px] font-medium tracking-normal transition-colors duration-100 ease-out ${sidebarLinkFocusRingClassName} motion-reduce:transition-none`;

export const sidebarLinkActiveClassName =
  "bg-sidebar-active text-sidebar-foreground";

export const sidebarLinkInactiveClassName =
  "text-sidebar-muted hover:bg-secondary hover:text-sidebar-foreground";

export function getSidebarLinkClassName(active?: boolean, className?: string) {
  return [
    sidebarLinkBaseClassName,
    active ? sidebarLinkActiveClassName : sidebarLinkInactiveClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
