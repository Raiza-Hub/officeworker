export function RecentInvoicesSection() {
  return (
    <section aria-labelledby="recent-invoices-heading" className="mt-9 pt-3">
      <h2
        id="recent-invoices-heading"
        className="m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-[#292a30]"
      >
        Recent invoices
      </h2>
      <div className="mt-4 flex h-[60px] items-center rounded-[10px] bg-white px-4 text-[13px] leading-[15.5px] font-[450] text-[#777a82] shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]">
        No invoices yet
      </div>
    </section>
  );
}
