import { MoreHorizontal } from "lucide-react";

export type IssueLabel = {
  name: string;
  created: string;
};

export function IssueLabelRow({ label }: { label: IssueLabel }) {
  return (
    <div
      role="row"
      className="group grid h-11 grid-cols-[60px_minmax(0,1fr)_75px_102px_82px_28px_32px] items-center text-[13px] leading-[15.5px] text-[#3f4148] transition-colors hover:bg-[#fcfcfd]"
    >
      <div className="flex h-full items-center pl-[22px]">
        <input
          type="checkbox"
          aria-label={`Select ${label.name} label`}
          className="size-3 opacity-0 accent-[#626bd9] transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>

      <div className="flex min-w-0 items-center gap-[17px] pl-[2.5px]">
        <span className="truncate font-medium text-[#292a30]">{label.name}</span>
      </div>

      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <time className="whitespace-nowrap text-[12px] leading-[14.5px] font-[450] text-[#5d5f66]">
        {label.created}
      </time>
      <button
        type="button"
        aria-label={`More actions for ${label.name}`}
        className="inline-flex size-8 items-center justify-center rounded-md text-[#656871] opacity-0 transition-[background-color,opacity] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#f1f1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/30"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </button>
      <span aria-hidden="true" />
    </div>
  );
}
