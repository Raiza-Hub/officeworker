import { HeaderSidebarTrigger } from "@/components/sidebar/sidebar-trigger";

export function BillingHeading() {
  return (
    <header className="flex h-15 flex-col gap-1 px-4">
      <div className="flex h-8 items-center gap-2">
        <HeaderSidebarTrigger />
        <h1 className="m-0 text-2xl leading-8 font-medium tracking-[-0.03em] text-ink">
          Billing
        </h1>
      </div>
      <div className="flex h-6 items-center justify-between gap-4">
        <p className="m-0 h-6 text-[13px] leading-5.5 font-[450] text-text-tertiary">
          For questions about billing,{" "}
          <button
            type="button"
            className="rounded-lg px-1 py-px text-[13px] leading-5.5 font-[450] text-ink-soft hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            contact us
          </button>
        </p>
      </div>
    </header>
  );
}
