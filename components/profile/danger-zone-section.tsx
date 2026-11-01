export function DangerZoneSection() {
  return (
    <section aria-labelledby="danger-zone-heading" className="mt-9 pt-3">
      <h2
        id="danger-zone-heading"
        className="m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-[#292a30]"
      >
        Danger zone
      </h2>
      <div className="mt-4 flex min-h-[72px] items-center justify-between gap-4 rounded-[10px] bg-white px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] leading-4 font-medium text-[#292a30]">
            Leave team
          </span>
          <span className="text-[12px] leading-4 text-[#777a82]">
            Remove yourself as a member of this team
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] leading-none font-medium text-[#6f727a] transition-colors hover:bg-[#ededf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
        >
          Leave team...
        </button>
      </div>
    </section>
  );
}
