"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActivityRowActionsMenu } from "@/components/activity/activity-row-actions-menu";
import { activityTableColumns } from "@/components/activity/activity-table-layout";

export type Activity = {
  name: string;
  created: string;
};

export function ActivityRow({ label }: { label: Activity }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rowRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div
      ref={rowRef}
      role="row"
      className={`group relative grid h-11 ${activityTableColumns} items-center text-[13px] leading-[15.5px] text-[#3f4148] transition-colors hover:bg-[#fcfcfd] ${isMenuOpen ? "bg-[#fcfcfd]" : ""}`}
    >
      <span aria-hidden="true" />

      <div className="flex min-w-0 items-center gap-[17px] pl-[2.5px]">
        <span className="truncate font-medium text-[#292a30]">{label.name}</span>
      </div>

      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <time className="whitespace-nowrap text-[12px] leading-[14.5px] font-[450] text-[#5d5f66]">
        {label.created}
      </time>
      <button
        type="button"
        aria-label={`More actions for ${label.name}`}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
        className={`inline-flex size-8 items-center justify-center rounded-md text-[#656871] transition-[background-color,opacity] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#f1f1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/30 ${isMenuOpen ? "bg-[#f1f1f2] opacity-100" : "opacity-0"}`}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </button>
      <span aria-hidden="true" />
      {isMenuOpen && (
        <ActivityRowActionsMenu onAction={() => setIsMenuOpen(false)} />
      )}
    </div>
  );
}
