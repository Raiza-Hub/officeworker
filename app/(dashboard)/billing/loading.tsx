export default function Loading() {
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-160">
        <div className="h-8 w-28 animate-pulse rounded bg-border-muted" />
        <div className="mt-8 space-y-3">
          <div className="h-30 animate-pulse rounded-[10px] bg-secondary" />
          <div className="h-30 animate-pulse rounded-[10px] bg-secondary" />
          <div className="mt-2 h-25 animate-pulse rounded-[10px] bg-secondary" />
        </div>
      </div>
    </div>
  );
}
