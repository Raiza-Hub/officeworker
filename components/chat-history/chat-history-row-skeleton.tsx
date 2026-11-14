"use client";

const nameWidths = ["w-48", "w-32", "w-56", "w-40"];

export function ChatHistoryRowSkeleton({ index = 0 }: { index?: number }) {
  const nameWidth = nameWidths[index % nameWidths.length];

  return (
    <li
      aria-hidden="true"
      className="flex h-7 list-none items-center gap-1.5 rounded-lg px-2"
    >
      <div className={`h-3.5 ${nameWidth} animate-pulse rounded bg-[#e5e5e7]`} />
    </li>
  );
}
