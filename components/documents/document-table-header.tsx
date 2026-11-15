import { ArrowDown } from "lucide-react";

const headers = ["Name", "Status", "Type", "Size", "Created"] as const;

export function DocumentTableHeader({ columnsClassName }: { columnsClassName: string }) {
  return (
    <div
      role="row"
      className={`grid h-8 items-center ${columnsClassName} pl-15 pr-8 text-xs leading-4 font-[450] text-text-dim`}
    >
      <span>{headers[0]}</span>
      <span className="inline-flex items-center gap-1">
        {headers[1]}
      </span>
      <span className="inline-flex items-center gap-1">
        {headers[2]}
        <ArrowDown aria-hidden="true" className="size-3" strokeWidth={2.25} />
      </span>
      <span>{headers[3]}</span>
      <span>{headers[4]}</span>
      <span aria-hidden="true" />
    </div>
  );
}
