export default function Loading() {
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="h-8 w-32 animate-pulse rounded bg-[#e5e5e7]" />
        <div className="mt-8 h-[200px] animate-pulse rounded-[10px] bg-[#f3f3f4]" />
        <div className="mt-9 pt-3">
          <div className="h-5 w-40 animate-pulse rounded bg-[#e5e5e7]" />
          <div className="mt-4 h-[65px] animate-pulse rounded-[10px] bg-[#f3f3f4]" />
        </div>
      </div>
    </div>
  );
}
