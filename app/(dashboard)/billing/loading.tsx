export default function Loading() {
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="h-8 w-28 animate-pulse rounded bg-[#e5e5e7]" />
        <div className="mt-8 space-y-3">
          <div className="h-[120px] animate-pulse rounded-[10px] bg-[#f3f3f4]" />
          <div className="h-[120px] animate-pulse rounded-[10px] bg-[#f3f3f4]" />
          <div className="mt-2 h-[100px] animate-pulse rounded-[10px] bg-[#f3f3f4]" />
        </div>
      </div>
    </div>
  );
}
