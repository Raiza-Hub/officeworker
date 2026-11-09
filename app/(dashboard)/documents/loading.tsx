import { DocumentTableHeader } from "@/components/documents/document-table-header";
import {
  DocumentRowSkeleton,
  documentTableColumns,
} from "@/components/documents/document-row-skeleton";

export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      {/* Header skeleton */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e9e9ec] px-[18px]">
        <div className="h-4 w-20 animate-pulse rounded bg-[#e5e5e7]" />
        <div className="flex shrink-0 items-center gap-1">
          <div className="h-7 w-28 animate-pulse rounded-md bg-[#f3f3f4]" />
        </div>
      </div>

      {/* View skeleton */}
      <div className="min-h-0 flex-1 overflow-auto bg-agent-page-bg">
        <div className="w-full px-[18px] pt-2 pb-10">
          {/* Toolbar skeleton */}
          <div className="flex h-[34px] w-full shrink-0 items-center justify-start">
            <div className="h-8 w-[300px] animate-pulse rounded-lg bg-[#f3f3f4]" />
          </div>

          {/* Table skeleton */}
          <div className="-mx-[18px] mt-5 w-[calc(100%+36px)] overflow-hidden text-[#24252a]">
            <DocumentTableHeader columnsClassName={documentTableColumns} />
            <div role="rowgroup">
              {Array.from({ length: 4 }).map((_, index) => (
                <DocumentRowSkeleton key={index} index={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
