"use client";

import { Pencil, Trash2 } from "lucide-react";

type ActivityRowActionsMenuProps = {
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
};

const menuItemClassName =
  "group/action relative isolate flex h-8 w-full items-center gap-2 rounded-none border-0 px-[18px] pl-[14px] text-left text-[13px] leading-normal font-[450] text-[lch(20_1_282)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/30";

const menuItemHoverBackgroundClassName =
  "pointer-events-none absolute inset-y-0 right-[6px] left-[6px] -z-10 rounded-[8px] bg-transparent transition-colors group-hover/action:bg-[lch(94.6%_0_282)] group-focus-within/action:bg-[lch(94.6%_0_282)]";

export function ActivityRowActionsMenu({
  onRename,
  onDelete,
  onClose,
}: ActivityRowActionsMenuProps) {
  return (
    <div
      role="menu"
      aria-label="Chat actions"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="absolute top-full right-[18px] z-30 mt-[-1px] w-[195px] rounded-[12px] border-[0.5px] border-[lch(91.9%_0_282)] bg-[lch(100%_0_282)] p-0"
      style={{
        boxShadow:
          "lch(0 0 0 / 0.02) 0 6px 18px 0, lch(0 0 0 / 0.04) 0 3px 9px 0, lch(0 0 0 / 0.04) 0 1px 1px 0",
      }}
    >
      <div aria-hidden="true" className="h-[6px] w-full" />

      <button
        type="button"
        role="menuitem"
        className={menuItemClassName}
        onClick={() => {
          onClose();
          onRename();
        }}
      >
        <span aria-hidden="true" className={menuItemHoverBackgroundClassName} />
        <Pencil aria-hidden="true" className="size-4 shrink-0 text-[lch(20_1_282)]" strokeWidth={2} />
        <span>Rename</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={menuItemClassName}
        onClick={() => {
          onClose();
          onDelete();
        }}
      >
        <span aria-hidden="true" className={menuItemHoverBackgroundClassName} />
        <Trash2 aria-hidden="true" className="size-4 shrink-0 text-[lch(20_1_282)]" strokeWidth={2} />
        <span>Delete</span>
      </button>

      <div aria-hidden="true" className="h-[6px] w-full" />
    </div>
  );
}
