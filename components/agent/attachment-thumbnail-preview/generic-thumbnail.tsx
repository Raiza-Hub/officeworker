"use client";

import { FileThumbnail } from "@/components/extend/file-thumbnail";

export function GenericFileThumbnail({
  attachment,
  isLoading,
  hasError,
}: {
  attachment: { name: string; mediaType: string };
  isLoading: boolean;
  hasError: boolean;
}) {
  return (
    <FileThumbnail
      file={{ name: attachment.name, type: attachment.mediaType }}
      previewAspectRatio={1}
      previewContent={
        <div className="flex size-full flex-col gap-2 bg-white p-3">
          <div className="h-2 w-2/3 rounded-sm bg-[#e4e5e9]" />
          <div className="h-1.5 w-full rounded-sm bg-[#ececf0]" />
          <div className="h-1.5 w-5/6 rounded-sm bg-[#ececf0]" />
          <div className="h-1.5 w-3/4 rounded-sm bg-[#ececf0]" />
          <div className="mt-1 grid flex-1 grid-cols-3 grid-rows-3 gap-px overflow-hidden rounded-sm border border-[#e5e6ea] bg-[#e5e6ea]">
            {Array.from({ length: 9 }, (_, index) => (
              <span
                key={index}
                className={index < 3 ? "bg-[#f1f2f5]" : "bg-white"}
              />
            ))}
          </div>
        </div>
      }
      isLoading={isLoading}
      hasError={hasError}
      className="w-full rounded-md border-0 bg-transparent shadow-none"
      previewClassName="rounded-md bg-white"
    />
  );
}
