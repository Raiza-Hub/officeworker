"use client";

import { useEffect, useState } from "react";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import { renderPdfThumbnailUrl } from "@/lib/pdf-thumbnail-utils";
import type { AttachmentThumbnailPreviewProps } from "./types";

export function PdfAttachmentThumbnail({
  attachment,
  fileUrl,
  isUploading,
}: AttachmentThumbnailPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!fileUrl) return;
    let current = true;
    void renderPdfThumbnailUrl({ pageIndex: 0, url: fileUrl, width: 240 })
      .then((nextImageUrl) => {
        if (!current) return;
        setImageUrl(nextImageUrl);
        setHasError(!nextImageUrl);
      })
      .catch(() => {
        if (current) setHasError(true);
      });
    return () => {
      current = false;
    };
  }, [fileUrl]);

  return (
    <FileThumbnail
      file={{ name: attachment.name, type: attachment.mediaType }}
      previewAspectRatio={1}
      previewClassName="bg-white [&>img]:object-cover [&>img]:object-top"
      previewImageUrl={imageUrl}
      isLoading={isUploading || (!imageUrl && !hasError)}
      hasError={hasError}
      className="w-full rounded-md border-0 bg-transparent shadow-none"
    />
  );
}
