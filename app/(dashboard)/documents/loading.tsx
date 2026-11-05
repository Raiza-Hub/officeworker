export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      {/* Header skeleton */}
      <div className="flex h-12 items-center border-b border-[#e9e9ec] px-4">
        <div className="h-5 w-28 animate-pulse rounded bg-[#e5e5e7]" />
      </div>
      {/* Table skeleton */}
      <div className="flex-1 p-[18px]">
        <div className="space-y-3 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded-lg bg-[#f3f3f4]"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
