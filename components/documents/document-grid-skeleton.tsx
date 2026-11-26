import { FileThumbnail } from "@/components/extend/file-thumbnail";

export function DocumentGridSkeleton({ count = 7 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="mt-4 grid grid-cols-1 list-none gap-x-4 gap-y-8 p-0 [--attachment-name-color:#24252a] [--attachment-name-leading:20px] [--attachment-name-size:14px] [--attachment-name-weight:500] [--preview-aspect-ratio:0.8] pointer-fine:[--attachment-name-leading:18px] pointer-fine:[--attachment-name-size:13px] max-md:pointer-fine:grid-cols-2 md:[--attachment-name-leading:18px] md:[--attachment-name-size:13px] md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="w-full min-w-0">
          <FileThumbnail
            file={{ name: "Loading preview", type: "application/octet-stream" }}
            previewAspectRatio={1}
            isLoading
            className="w-full rounded-md border-0 bg-transparent shadow-none"
            previewClassName="rounded-md bg-border-muted"
          />
          <div className="mt-1 h-[18px] w-4/5 animate-pulse rounded bg-border-muted pointer-fine:h-[16px] md:h-[16px]" />
          <div className="mt-1 h-[18px] w-3/5 animate-pulse rounded bg-border-muted pointer-fine:h-[16px] md:h-[16px]" />
        </li>
      ))}
    </ul>
  );
}
