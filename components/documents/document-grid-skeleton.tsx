export function DocumentGridSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="mt-8 grid justify-between grid-cols-[repeat(auto-fill,10rem)] gap-x-3 gap-y-6"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="w-40">
          <div className="aspect-square w-full animate-pulse rounded-lg bg-border-muted" />
          <div className="mt-1 h-3 w-4/5 animate-pulse rounded bg-border-muted" />
          <div className="mt-1 h-3 w-3/5 animate-pulse rounded bg-border-muted" />
        </div>
      ))}
    </div>
  );
}
