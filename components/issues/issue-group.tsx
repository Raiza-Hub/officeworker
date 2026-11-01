import { ChevronDown, CircleDot, Plus } from "lucide-react";
import { IssueRow, type Issue } from "@/components/issues/issue-row";

export function IssueGroup({
  title,
  issues,
}: {
  title: string;
  issues: Issue[];
}) {
  return (
    <section aria-labelledby="todo-group-title" className="pt-0">
      <div className="mx-2 flex h-9 items-center justify-between rounded-lg bg-[#f0f0f2] pr-2 pl-1">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            aria-label={`Collapse ${title} group`}
            aria-expanded="true"
            className="inline-flex size-6 items-center justify-center rounded-md text-[#a9b3d5] transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
          >
            <ChevronDown aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
          </button>
          <CircleDot
            aria-hidden="true"
            className="ml-1.5 size-3.5 shrink-0 text-[#a3a5ab]"
            strokeWidth={1.8}
          />
          <h2
            id="todo-group-title"
            className="ml-2 text-[13px] leading-4 font-medium text-[#34363c]"
          >
            {title}
          </h2>
          <span className="ml-2 text-[13px] leading-4 text-[#8a8c93]">
            {issues.length}
          </span>
        </div>
        <button
          type="button"
          aria-label="Create new issue"
          className="inline-flex size-6 items-center justify-center rounded-md text-[#656871] transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
        >
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
        </button>
      </div>
      <div role="list" aria-label={`${title} issues`} className="mt-0.5">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </section>
  );
}
