"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import GlideSelect from "@/components/ui/glide-select";
import SquishSwitch from "@/components/ui/squish-switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  activeDocumentFilterCount,
  createdAfterFor,
  defaultDocumentFilters,
  type DocumentDateRange,
  type DocumentFilters,
  type DocumentKind,
  type DocumentSizeBucket,
} from "@/components/documents/document-filters";

const TYPE_OPTIONS: { value: DocumentKind; label: string; tag?: string }[] = [
  { value: "all", label: "Any" },
  { value: "pdf", label: "PDF", tag: "Print" },
  { value: "word", label: "Word", tag: "Editable" },
  { value: "sheet", label: "Spreadsheets", tag: "Data" },
  { value: "slide", label: "Slides", tag: "Deck" },
  { value: "image", label: "Images", tag: "Media" },
  { value: "other", label: "Other", tag: "Misc" },
];

const SIZE_OPTIONS: { value: DocumentSizeBucket; label: string; tag?: string }[] = [
  { value: "all", label: "Any" },
  { value: "small", label: "Small", tag: "<1MB" },
  { value: "medium", label: "Medium", tag: "1-10MB" },
  { value: "large", label: "Large", tag: ">10MB" },
];

const DATE_OPTIONS: { value: DocumentDateRange; label: string; tag?: string }[] = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today", tag: "New" },
  { value: "week", label: "Last 7 days", tag: "Recent" },
  { value: "month", label: "Last 30 days", tag: "Month" },
];

const selectProps = {
  size: "sm" as const,
  radius: 12,
  showTags: true,
  menuWidth: 200,
  align: "right" as const,
  placement: "bottom" as const,
  popDuration: 180,
  glideDuration: 220,
  rememberPosition: true,
  surfaceColor: "#ffffff",
  textColor: "#34363c",
  highlightColor: "#f0f0f2",
  accentColor: "#6874db",
};

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5">
      <span className="text-[13px] text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

type Props = {
  filters?: DocumentFilters;
  onFiltersChange?: (filters: DocumentFilters) => void;
};

export function SearchFilterPopover({
  filters = defaultDocumentFilters,
  onFiltersChange,
}: Props) {
  const count = activeDocumentFilterCount(filters);
  const isActive = count > 0;
  const reduceMotion = useReducedMotion();
  const instantTransition = { duration: 0 };

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Filter documents"
        render={
          <m.button
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduceMotion ? instantTransition : undefined}
            className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-[#dedee3] bg-white transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6874db]/15 ${isActive ? "text-[#4a54c4]" : "text-text-dim"}`}
          />
        }
      >
        <SlidersHorizontal aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />
        {isActive ? (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#6874db]" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-72 gap-0 rounded-xl p-1.5"
      >
        <FilterRow label="File type">
          <GlideSelect
            {...selectProps}
            ariaLabel="Filter by file type"
            options={TYPE_OPTIONS}
            value={filters.kind}
            onChange={(value) => onFiltersChange?.({ ...filters, kind: value as DocumentKind })}
          />
        </FilterRow>
        <FilterRow label="File size">
          <GlideSelect
            {...selectProps}
            ariaLabel="Filter by file size"
            options={SIZE_OPTIONS}
            value={filters.size}
            onChange={(value) => onFiltersChange?.({ ...filters, size: value as DocumentSizeBucket })}
          />
        </FilterRow>
        <FilterRow label="Date uploaded">
          <GlideSelect
            {...selectProps}
            ariaLabel="Filter by date uploaded"
            options={DATE_OPTIONS}
            value={filters.date}
            onChange={(value) => {
              const date = value as DocumentDateRange;
              onFiltersChange?.({ ...filters, date, createdAfter: createdAfterFor(date) });
            }}
          />
        </FilterRow>
        <FilterRow label="Show uploads in progress">
          <SquishSwitch
            checked={filters.showUploading}
            onChange={(checked) => onFiltersChange?.({ ...filters, showUploading: checked })}
            ariaLabel="Show uploads in progress"
            width={32}
            height={18}
            radius={9}
            speed={50}
            stretch={36}
            hoverScale={1.035}
            colorDuration={320}
            trackColor="#e5e5e7"
            trackOnColor="#6874db"
            thumbColor="#ffffff"
            thumbOnColor="#ffffff"
          />
        </FilterRow>
        {isActive ? (
          <div className="flex justify-end px-2 pt-1 pb-0.5">
            <button
              type="button"
              onClick={() => onFiltersChange?.(defaultDocumentFilters)}
              className="text-xs font-medium text-text-tertiary transition-colors hover:text-text-secondary"
            >
              Reset
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
