"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { useStableDocumentSearch, DOCUMENTS_PAGE_SIZE } from "@/components/documents/use-stable-paginated-query";
import { DocumentEmptyState } from "@/components/documents/document-empty-state";
import { DocumentTableHeader } from "@/components/documents/document-table-header";

const tableColumns = "grid-cols-[minmax(0,1fr)_120px_92px_82px_82px_28px]";
const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"];
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });

function formatBytes(size: number): string {
  if (size <= 0) return "0 B";
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${Math.round(value)} ${SIZE_UNITS[unitIndex]}`;
}

function getFileTypeLabel(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === name.length - 1) return "File";
  return name.slice(dotIndex + 1).toLowerCase();
}

export function DocumentTable({ searchTerm }: { searchTerm: string }) {
  const { results, status, loadMore, searchTerm: shownTerm } = useStableDocumentSearch(searchTerm);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || status !== "CanLoadMore") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore(DOCUMENTS_PAGE_SIZE);
        }
      },
      { rootMargin: "80px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, status]);

  return (
    <div className="-mx-[18px] mt-5 w-[calc(100%+36px)] overflow-hidden text-[#24252a]">
      <DocumentTableHeader columnsClassName={tableColumns} />

      {status !== "LoadingFirstPage" ? (
        <>
          {results.map((doc) => {
            const isUploading = doc.status === "Uploading";
            return (
              <div
                key={doc._id}
                role="row"
                className={`group grid h-11 items-center ${tableColumns} pl-[60px] pr-8 text-[12px] leading-4 text-[#3f4148] transition-colors hover:bg-[#f7f7f8]`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="flex size-[18px] shrink-0 items-center justify-center">
                    <svg viewBox="0 0 14 14" className="size-3.5" fill="none">
                      <rect x="1.5" y="3" width="11" height="8" rx="1.5" fill="#5f7cf0" />
                      <path d="M3.75 6.25h6.5M3.75 8.5h6.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="truncate text-[13px] font-medium text-[#292a30]">{doc.name}</span>
                </div>
                <span className={`font-medium${isUploading ? " animate-pulse text-[#a0a2a8]" : ""}`}>
                  {isUploading ? "Uploading…" : "Success"}
                </span>
                <span>{getFileTypeLabel(doc.name)}</span>
                <span>{formatBytes(doc.size)}</span>
                <span>{dateFormatter.format(doc._creationTime)}</span>
                <button
                  type="button"
                  aria-label={isUploading ? "Upload in progress" : "More document actions"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#656870] opacity-0 transition-[background-color,opacity] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#f1f1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/30"
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            );
          })}

          {results.length === 0 ? (
            shownTerm.trim().length > 0 ? (
              <div className="mx-2 mt-3 rounded-[9px] border border-dashed border-[#dedee3] px-[52px] py-6 text-[12px] font-medium text-[#656870]">
                No documents match &quot;{shownTerm.trim()}&quot;
              </div>
            ) : (
              <DocumentEmptyState />
            )
          ) : null}

          {status === "LoadingMore" ? (
            <div className="mx-2 flex h-9 items-center px-[52px] text-[12px] font-medium text-[#a0a2a8]">
              Loading…
            </div>
          ) : null}

          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
        </>
      ) : null}
    </div>
  );
}
