import { ArrowDown } from "lucide-react";
import { IssueLabelRow, type IssueLabel } from "@/components/issues/issue-label-row";

const labels: IssueLabel[] = [
  { name: "Bug", created: "Oct 29" },
  {
    name: "Feature",
    created: "Oct 29",
  },
  {
    name: "Improvement",
    created: "Oct 29",
  },
];

const tableColumns =
  "grid-cols-[60px_minmax(0,1fr)_75px_102px_82px_28px_32px]";

function SortableHeader({ children, sorted = false }: { children: string; sorted?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Order by ${children}${sorted ? ", sorted ascending" : ""}`}
      className="inline-flex h-6 items-center gap-1 rounded-md px-0 text-left text-[12px] leading-[14.5px] font-[450] text-[#5b5d65] transition-colors hover:text-[#292a30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/30"
    >
      {children}
      <ArrowDown
        aria-hidden="true"
        className="size-3"
        strokeWidth={2}
        opacity={sorted ? 1 : 0}
      />
    </button>
  );
}

function IssueLabelsTableHeader() {
  return (
    <div role="row" className={`grid h-8 items-center ${tableColumns} text-[#5b5d65]`}>
      <span aria-hidden="true" />
      <div className="flex items-center pl-0">
        <SortableHeader sorted>Name</SortableHeader>
      </div>
      <div className="flex items-center">
        <SortableHeader>Status</SortableHeader>
      </div>
      <div className="flex items-center">
        <SortableHeader>Documents</SortableHeader>
      </div>
      <div className="flex items-center">
        <SortableHeader>Created</SortableHeader>
      </div>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}

export function IssueLabelsTable() {
  return (
    <div role="table" aria-label="Issue labels" className="min-w-[900px] text-[#24252a]">
      <IssueLabelsTableHeader />
      <div role="rowgroup">
        {labels.map((label) => (
          <IssueLabelRow key={label.name} label={label} />
        ))}
      </div>
    </div>
  );
}
