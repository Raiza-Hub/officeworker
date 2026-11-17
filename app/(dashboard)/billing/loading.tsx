export default function Loading() {
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-160">
        <div className="h-8 w-28 animate-pulse rounded bg-border-muted" />
        <div className="mt-8 px-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="h-4 w-28 animate-pulse rounded bg-secondary" />
              <div className="mt-2 h-3.5 w-56 animate-pulse rounded bg-secondary" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded-full bg-secondary" />
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <div className="h-30 animate-pulse rounded-[10px] bg-secondary" />
          <div className="h-30 animate-pulse rounded-[10px] bg-secondary" />
        </div>
      </div>
    </div>
  );
}
