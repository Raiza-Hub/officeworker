"use client";

import { ChevronRight, Flag } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const menuItemClassName =
  "group/action relative isolate flex h-8 w-full items-center gap-2 rounded-none border-0 px-4.5 pl-3.5 text-left text-[13px] leading-normal font-[450] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

const menuItemHoverBackgroundClassName =
  "pointer-events-none absolute inset-y-0 right-1.5 left-1.5 -z-10 rounded-lg bg-transparent transition-colors group-hover/action:bg-surface-hover";

export function BillingHistoryRowActions({
  intentId,
  reference,
}: {
  intentId: Id<"topupIntents">;
  reference: string;
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const createReport = useMutation(api.paymentReports.create);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      requestAnimationFrame(() => {
        triggerRef.current?.blur();
      });
    }
  };

  async function handleReport() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createReport({ intentId });
      setOpen(false);
      toast.success("Problem reported");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not report the problem",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        aria-label={`Report a problem for ${reference}`}
        className="inline-flex size-7 shrink-0 items-center justify-center justify-self-end rounded-full text-text-dim transition-colors hover:bg-surface-hover-soft hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40 data-[popup-open]:bg-surface-hover-soft data-[popup-open]:text-secondary-foreground"
      >
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0"
          strokeWidth={2.25}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-50 w-[195px] gap-0 rounded-xl border-[0.5px] border-border-soft bg-popover p-0 shadow-none ring-0"
        onClick={(event) => event.stopPropagation()}
        side="bottom"
        sideOffset={4}
        style={{
          boxShadow:
            "lch(0 0 0 / 0.02) 0 6px 18px 0, lch(0 0 0 / 0.04) 0 3px 9px 0, lch(0 0 0 / 0.04) 0 1px 1px 0",
        }}
      >
        <div aria-hidden="true" className="h-1.5 w-full" />
        <button
          className={menuItemClassName}
          disabled={isSubmitting}
          onClick={() => void handleReport()}
          type="button"
        >
          <span aria-hidden="true" className={menuItemHoverBackgroundClassName} />
          <Flag
            aria-hidden="true"
            className="size-3.5 shrink-0 text-foreground"
            strokeWidth={2.25}
          />
          <span>Report a problem</span>
        </button>
        <div aria-hidden="true" className="h-1.5 w-full" />
      </PopoverContent>
    </Popover>
  );
}
