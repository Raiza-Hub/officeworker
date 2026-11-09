import { ActivityRowSkeleton } from "@/components/activity/activity-row-skeleton";
import { activityTableColumns } from "@/components/activity/activity-table-layout";

export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      {/* Header skeleton */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e9e9ec] px-[18px]">
        <div className="h-4 w-16 animate-pulse rounded bg-[#e5e5e7]" />
        <div className="flex shrink-0 items-center gap-1">
          <div className="h-7 w-20 animate-pulse rounded-md bg-[#f3f3f4]" />
        </div>
      </div>

      {/* View skeleton */}
      <div className="min-h-0 flex-1 overflow-auto">
        {/* Toolbar skeleton */}
        <div className="flex h-11 shrink-0 items-center justify-between px-[18px]">
          <div className="h-7 w-[300px] animate-pulse rounded-full bg-[#f3f3f4]" />
          <div className="size-7 animate-pulse rounded-full bg-[#f3f3f4]" />
        </div>

        {/* Table skeleton */}
        <div
          role="table"
          aria-label="Chat activity"
          className="min-w-[900px] text-[#24252a]"
        >
          <div
            role="row"
            className={`grid h-8 items-center ${activityTableColumns} text-[#5b5d65]`}
          >
            <span aria-hidden="true" />
            <div className="h-3 w-10 animate-pulse rounded bg-[#e5e5e7]" />
            <div className="h-3 w-12 animate-pulse rounded bg-[#e5e5e7]" />
            <div className="h-3 w-16 animate-pulse rounded bg-[#e5e5e7]" />
            <div className="h-3 w-14 animate-pulse rounded bg-[#e5e5e7]" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <div role="rowgroup">
            {Array.from({ length: 4 }).map((_, index) => (
              <ActivityRowSkeleton key={index} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
