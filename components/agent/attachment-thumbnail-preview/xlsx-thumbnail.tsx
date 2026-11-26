"use client";

import { useEffect, useState } from "react";
import { loadPreviewBuffer } from "../preview-file-loader";
import { GenericFileThumbnail } from "./generic-thumbnail";
import type { AttachmentThumbnailPreviewProps } from "./types";
import { XlsxAttachmentThumbnail } from "./xlsx-thumbnail-capture";

export function XlsxAttachmentThumbnailLoader({
  attachment,
  fileUrl,
  isUploading,
  sourceError,
}: AttachmentThumbnailPreviewProps) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!fileUrl) return;
    const controller = new AbortController();
    void loadPreviewBuffer(fileUrl, controller.signal)
      .then((nextBuffer) => {
        if (!controller.signal.aborted) setBuffer(nextBuffer);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHasError(true);
      });
    return () => {
      controller.abort();
    };
  }, [fileUrl]);

  if (sourceError || hasError) {
    return (
      <GenericFileThumbnail
        attachment={attachment}
        isLoading={isUploading}
        hasError
      />
    );
  }
  if (!buffer) {
    return (
      <GenericFileThumbnail
        attachment={attachment}
        isLoading={isUploading || !hasError}
        hasError={hasError}
      />
    );
  }
  return (
    <XlsxAttachmentThumbnail
      attachment={attachment}
      workbookBuffer={buffer}
      isUploading={isUploading}
    />
  );
}
