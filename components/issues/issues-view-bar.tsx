import { Filter, Layers2, PanelRight, SlidersHorizontal } from "lucide-react";

const views = ["Active", "Backlog", "All issues"] as const;

function ViewTabs() {
  return (
    <nav aria-label="Issue views" className="flex items-center gap-1">
      {views.map((view) => {
        const active = view === "Active";

        return (
          <button
            key={view}
            type="button"
            aria-pressed={active}
            className={`inline-flex h-7 items-center rounded-full px-[10px] text-[13px] leading-4 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40 ${
              active
                ? "bg-[#ececef] text-[#303137]"
                : "bg-white text-[#666971] shadow-[0_0.5px_1px_rgba(0,0,0,0.07)] hover:bg-[#f7f7f8]"
            }`}
          >
            {view}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Add new view"
        className="inline-flex size-7 items-center justify-center rounded-md text-[#73767e] transition-colors hover:bg-[#f0f0f2] hover:text-[#34363c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
      >
        <Layers2 aria-hidden="true" className="size-3.5" strokeWidth={2} />
      </button>
    </nav>
  );
}

function IssueToolbar() {
  const actions = [
    { label: "Add filter", Icon: Filter },
    { label: "Sort issues", Icon: SlidersHorizontal },
    { label: "Open details", Icon: PanelRight },
  ];

  return (
    <div className="flex items-center gap-2">
      {actions.map(({ label, Icon }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          className="inline-flex size-7 items-center justify-center rounded-full border border-[#e7e7ea] bg-white text-[#73767e] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#f7f7f8] hover:text-[#34363c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
        >
          <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
        </button>
      ))}
    </div>
  );
}

export function IssuesViewBar() {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#eeeeef] px-2">
      <ViewTabs />
      <IssueToolbar />
    </div>
  );
}
