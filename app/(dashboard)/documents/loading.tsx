import { DocumentGridSkeleton } from "@/components/documents/document-grid-skeleton";

export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-ink">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e9e9ec] px-4.5">
        <div className="h-4 w-20 animate-pulse rounded bg-border-muted" />
        <div className="flex shrink-0 items-center gap-1">
          <div className="h-7 w-28 animate-pulse rounded-md bg-secondary" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-agent-page-bg">
        <div className="w-full px-4.5 pt-2 pb-10">
          <div className="flex h-8.5 w-full shrink-0 items-center justify-start">
            <div className="h-8 w-75 animate-pulse rounded-lg bg-secondary" />
          </div>

          <DocumentGridSkeleton />
        </div>
      </div>
    </div>
  );
}
