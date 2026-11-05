"use client";

import { useState } from "react";
import { DocumentTable } from "@/components/documents/document-table";
import { DocumentToolbar } from "@/components/documents/document-toolbar";
import { useDebouncedValue } from "@/components/documents/use-debounced-value";

export function DocumentView() {
  const [search, setSearch] = useState("");
  const searchTerm = useDebouncedValue(search, 250);

  return (
    <section aria-label="Documents" className="min-h-0 flex-1 overflow-auto bg-agent-page-bg">
      <div className="w-full px-[18px] pt-2 pb-10">
        <DocumentToolbar search={search} onSearchChange={setSearch} />
        <DocumentTable searchTerm={searchTerm} />
      </div>
    </section>
  );
}
