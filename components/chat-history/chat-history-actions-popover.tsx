"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ChatHistoryActionsPopoverProps = {
  title: string;
  onRename: () => void;
  onDelete: () => void;
  startHiddenOnMobile?: boolean;
};

export function ChatHistoryActionsPopover({
  title,
  onRename,
  onDelete,
  startHiddenOnMobile = false,
}: ChatHistoryActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      requestAnimationFrame(() => {
        triggerRef.current?.blur();
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        aria-label={`More actions for ${title}`}
        className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[#656871] ${startHiddenOnMobile ? "opacity-0" : "opacity-100"} transition-[background-color,opacity] md:opacity-0 group-hover:opacity-100 hover:bg-[#f1f1f2] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[popup-open]:bg-[#f1f1f2] data-[popup-open]:opacity-100`}
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="z-50 w-[195px] gap-0 rounded-xl border-[0.5px] border-[lch(91.9%_0_282)] bg-[lch(100%_0_282)] p-0 shadow-none ring-0"
        style={{
          boxShadow:
            "lch(0 0 0 / 0.02) 0 6px 18px 0, lch(0 0 0 / 0.04) 0 3px 9px 0, lch(0 0 0 / 0.04) 0 1px 1px 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="h-1.5 w-full" />
        <button
          type="button"
          className="group/action relative isolate flex h-8 w-full items-center gap-2 rounded-none border-0 px-4.5 pl-3.5 text-left text-[13px] leading-normal font-[450] text-[lch(20_1_282)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => {
            setOpen(false);
            onRename();
          }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-1.5 left-1.5 -z-10 rounded-lg bg-transparent transition-colors group-hover/action:bg-[lch(94.6%_0_282)]" />
          <Pencil aria-hidden="true" className="size-3.5 shrink-0 text-[lch(20_1_282)]" strokeWidth={2.25} />
          <span>Rename</span>
        </button>
        <button
          type="button"
          className="group/action relative isolate flex h-8 w-full items-center gap-2 rounded-none border-0 px-4.5 pl-3.5 text-left text-[13px] leading-normal font-[450] text-[lch(20_1_282)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-1.5 left-1.5 -z-10 rounded-lg bg-transparent transition-colors group-hover/action:bg-[lch(94.6%_0_282)] group-focus-within/action:bg-[lch(94.6%_0_282)]" />
          <Trash2 aria-hidden="true" className="size-3.5 shrink-0 text-[lch(20_1_282)]" strokeWidth={2.25} />
          <span>Delete</span>
        </button>
        <div aria-hidden="true" className="h-1.5 w-full" />
      </PopoverContent>
    </Popover>
  );
}
