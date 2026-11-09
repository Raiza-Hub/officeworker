export const documentTableColumns =
  "grid-cols-[minmax(0,1fr)_120px_92px_82px_82px_28px]";

const nameWidths = ["w-52", "w-36", "w-64", "w-44"];

export function DocumentRowSkeleton({ index = 0 }: { index?: number }) {
  const nameWidth = nameWidths[index % nameWidths.length];

  return (
    <div
      role="row"
      aria-hidden="true"
      className={`grid h-11 items-center ${documentTableColumns} pl-[60px] pr-8 text-[12px]`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="size-[18px] shrink-0 animate-pulse rounded bg-[#e5e5e7]"
        />
        <div
          className={`h-3.5 ${nameWidth} animate-pulse rounded bg-[#e5e5e7]`}
        />
      </div>
      <div>
        <div className="h-3 w-14 animate-pulse rounded bg-[#e5e5e7]" />
      </div>
      <div>
        <div className="h-3 w-8 animate-pulse rounded bg-[#e5e5e7]" />
      </div>
      <div>
        <div className="h-3 w-12 animate-pulse rounded bg-[#e5e5e7]" />
      </div>
      <div>
        <div className="h-3 w-12 animate-pulse rounded bg-[#e5e5e7]" />
      </div>
      <span aria-hidden="true" />
    </div>
  );
}
