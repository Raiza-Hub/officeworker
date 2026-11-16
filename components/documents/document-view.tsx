"use client";

import { useState } from "react";
import { DocumentGrid } from "@/components/documents/document-grid";
import { DocumentToolbar } from "@/components/documents/document-toolbar";
import { useDebouncedValue } from "@/components/documents/use-debounced-value";
import {
  defaultDocumentFilters,
  type DocumentFilters,
} from "@/components/documents/document-filters";

export function DocumentView() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<DocumentFilters>(defaultDocumentFilters);
  const searchTerm = useDebouncedValue(search, 250);

  return (
    <section aria-label="Documents" className="min-h-0 flex-1 overflow-auto bg-agent-page-bg">
      <div className="w-full px-2 pt-2 pb-10">
        <DocumentToolbar
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <DocumentGrid searchTerm={searchTerm} filters={filters} />
      </div>
    </section>
  );
}
