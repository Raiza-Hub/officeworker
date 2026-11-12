"use client";

import { FileThumbnail } from "@/components/extend/file-thumbnail";
import type { AttachmentThumbnailPreviewProps } from "./types";

export function ImageAttachmentThumbnail({
  attachment,
  fileUrl,
  isUploading,
  sourceError,
}: AttachmentThumbnailPreviewProps) {
  return (
    <FileThumbnail
      file={{ name: attachment.name, type: attachment.mediaType }}
      previewAspectRatio={1}
      previewImageUrl={fileUrl}
      isLoading={isUploading || (!fileUrl && !sourceError)}
      hasError={sourceError}
      className="w-full rounded-md border-0 bg-transparent shadow-none"
      previewClassName="rounded-md [&>img]:object-cover"
    />
  );
}
