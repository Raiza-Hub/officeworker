export function WorkspaceAccessSection() {
  return (
    <section aria-labelledby="workspace-access-heading" className="mt-9 pt-3">
      <h2
        id="workspace-access-heading"
        className="m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-[#292a30]"
      >
        Workspace access
      </h2>
      <div className="mt-4 flex h-16 items-center justify-between gap-3 rounded-[10px] bg-white px-4">
        <span className="text-[13px] leading-none text-[#777a82]">
          Remove yourself from workspace
        </span>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] leading-none font-medium text-[#6f727a] transition-colors hover:bg-[#ededf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
        >
          Leave workspace
        </button>
      </div>
    </section>
  );
}
