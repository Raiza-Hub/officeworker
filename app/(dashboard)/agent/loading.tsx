export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      {/* Header skeleton */}
      <div className="flex h-12 items-center border-b border-[#e9e9ec] px-4">
        <div className="h-5 w-20 animate-pulse rounded bg-[#e5e5e7]" />
      </div>
      {/* Composer skeleton */}
      <div className="relative min-h-0 flex-1 p-6">
        <div className="mx-auto w-full max-w-[712px] pt-[calc(50svh-180px)] max-[700px]:pt-24">
          <div className="h-[120px] animate-pulse rounded-2xl bg-[#f3f3f4]" />
        </div>
      </div>
    </div>
  );
}
