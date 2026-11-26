"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { getSidebarLinkClassName } from "./sidebar-link-utils";

type SidebarLinkProps = Omit<ComponentProps<typeof Link>, "href" | "className"> & {
  href: string;
  active?: boolean;
  className?: string;
  children: ReactNode;
};

export function SidebarLink({
  href,
  active,
  className,
  children,
  ...props
}: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={getSidebarLinkClassName(active, className)}
      {...props}
    >
      {children}
    </Link>
  );
}
