"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import { loadPreviewText } from "../preview-file-loader";
import type { AttachmentThumbnailPreviewProps } from "./types";

export function CsvAttachmentThumbnail({
  attachment,
  fileUrl,
  isUploading,
}: AttachmentThumbnailPreviewProps) {
  const [cells, setCells] = useState<string[][] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!fileUrl) return;
    const controller = new AbortController();
    void loadPreviewText(fileUrl, controller.signal)
      .then((text) => {
        if (controller.signal.aborted) return;
        const result = Papa.parse<string[]>(text, {
          preview: 5,
          skipEmptyLines: true,
        });
        setCells(result.data.slice(0, 5).map((row) => row.slice(0, 4)));
      })
      .catch(() => {
        if (!controller.signal.aborted) setHasError(true);
      });
    return () => {
      controller.abort();
    };
  }, [fileUrl]);

  const previewContent = cells ? (
    <div className="grid size-full grid-cols-4 grid-rows-5 gap-px overflow-hidden bg-[#dfe2e8] p-px">
      {Array.from({ length: 20 }, (_, index) => {
        const row = Math.floor(index / 4);
        const column = index % 4;
        return (
          <div
            key={index}
            className={`overflow-hidden px-1 text-[5px] leading-[10px] ${row === 0 ? "bg-[#eef0f4] font-semibold text-[#555a65]" : "bg-white text-[#777c85]"}`}
          >
            {cells[row]?.[column] ?? ""}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <FileThumbnail
      file={{ name: attachment.name, type: attachment.mediaType }}
      previewAspectRatio={1}
      previewClassName="bg-white"
      previewContent={previewContent}
      isLoading={isUploading || (!cells && !hasError)}
      hasError={hasError}
      className="w-full rounded-md border-0 bg-transparent shadow-none"
    />
  );
}
