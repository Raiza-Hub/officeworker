import { activityTableColumns } from "@/components/activity/activity-table-layout";

const nameWidths = ["w-48", "w-32", "w-56", "w-40"];

export function ActivityRowSkeleton({ index = 0 }: { index?: number }) {
  const nameWidth = nameWidths[index % nameWidths.length];

  return (
    <li
      aria-hidden="true"
      className={`grid h-11 list-none ${activityTableColumns} items-center text-[13px]`}
    >
      <span aria-hidden="true" />
      <div className="flex min-w-0 items-center pl-[2.5px]">
        <div
          className={`h-3.5 ${nameWidth} animate-pulse rounded bg-[#e5e5e7]`}
        />
      </div>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <div>
        <div className="h-3 w-12 animate-pulse rounded bg-[#e5e5e7]" />
      </div>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </li>
  );
}
