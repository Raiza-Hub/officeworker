"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex">{children}</span>} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

type InlineRegistryIconProps = Omit<
  React.ComponentProps<"svg">,
  "children" | "strokeWidth"
> & { strokeWidth?: number };

export function InlineSpinner({
  className,
  ...props
}: InlineRegistryIconProps) {
  return (
    <LoaderCircle
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}
