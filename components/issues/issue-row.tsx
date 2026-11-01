import { Circle, UsersRound } from "lucide-react";

export type Issue = {
  id: string;
  title: string;
  created: string;
};

function PriorityMark() {
  return (
    <svg
      aria-label="No priority"
      className="size-4 text-[#898b92]"
      viewBox="0 0 16 16"
      fill="none"
      role="img"
    >
      <path
        d="M2.5 5h3M6.5 5h3M10.5 5h3M2.5 8h3M6.5 8h3M10.5 8h3M2.5 11h3M6.5 11h3M10.5 11h3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function IssueRow({ issue }: { issue: Issue }) {
  return (
    <div
      role="listitem"
      aria-label={`${issue.id}: ${issue.title}`}
      className="grid h-11 grid-cols-[18px_16px_42px_16px_minmax(0,1fr)_60px] items-center gap-2 pr-[26px] pl-4 text-[13px] leading-4 transition-colors hover:bg-[#f3f3f4]"
    >
      <button
        type="button"
        aria-label={`Select ${issue.id}`}
        className="flex h-[22px] w-[18px] items-center justify-start text-[#9a9ca3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
      >
        <Circle aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      </button>
      <span className="flex items-center justify-center">
        <PriorityMark />
      </span>
      <span className="truncate text-[#71747c]">{issue.id}</span>
      <span className="flex items-center justify-center text-[#a4a6ac]">
        <Circle aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 truncate font-medium text-[#28292e]">
        {issue.title}
      </span>
      <span className="flex min-w-0 items-center justify-between gap-2 text-[12px] text-[#777a82]">
        <UsersRound
          aria-label="Unassigned"
          className="size-3.5 shrink-0 text-[#a2a4aa]"
          strokeWidth={2}
        />
        <time className="whitespace-nowrap">{issue.created}</time>
      </span>
    </div>
  );
}
