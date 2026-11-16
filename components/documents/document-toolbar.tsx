"use client";

import { ExpandingSearchDock } from "@/components/ui/expanding-search-dock";
import { SearchFilterPopover } from "@/components/documents/search-filter-popover";
import type { DocumentFilters } from "@/components/documents/document-filters";

type DocumentToolbarProps = {
  onSearchChange: (value: string) => void;
  filters: DocumentFilters;
  onFiltersChange: (filters: DocumentFilters) => void;
};

export function DocumentToolbar({ onSearchChange, filters, onFiltersChange }: DocumentToolbarProps) {
  return (
    <div className="flex h-8.5 w-full shrink-0 items-center justify-end gap-1.5">
      <ExpandingSearchDock
        onQueryChange={onSearchChange}
        placeholder="Filter by name…"
      />
      <SearchFilterPopover filters={filters} onFiltersChange={onFiltersChange} />
    </div>
  );
}
