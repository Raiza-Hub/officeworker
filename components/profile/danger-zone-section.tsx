export function DangerZoneSection() {
  return (
    <section aria-labelledby="danger-zone-heading" className="mt-9 pt-3">
      <h2
        id="danger-zone-heading"
        className="m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-[#292a30]"
      >
        Danger zone
      </h2>
      <div className="mt-4 flex min-h-[72px] items-center justify-between gap-4 rounded-[10px] bg-white px-4 py-3 shadow-[0_0_0_0.5px_rgba(0,0,0,0.09),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] leading-4 font-medium text-[#292a30]">
            Delete Account
          </span>
          <span className="text-[12px] leading-4 text-[#777a82]">
            This action cannot be undone.
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] leading-none font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
        >
          Delete account
        </button>
      </div>
    </section>
  );
}
