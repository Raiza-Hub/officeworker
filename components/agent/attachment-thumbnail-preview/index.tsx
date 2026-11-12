"use client";

import { getFileExtension } from "@/lib/file-types";
import { CsvAttachmentThumbnail } from "./csv-thumbnail";
import { DocxAttachmentThumbnail } from "./docx-thumbnail";
import { GenericFileThumbnail } from "./generic-thumbnail";
import { ImageAttachmentThumbnail } from "./image-thumbnail";
import { PdfAttachmentThumbnail } from "./pdf-thumbnail";
import { PptxAttachmentThumbnail } from "./pptx-thumbnail";
import type { AttachmentThumbnailPreviewProps } from "./types";
import { XlsxAttachmentThumbnailLoader } from "./xlsx-thumbnail";

export function AttachmentThumbnailPreview({
  attachment,
  fileUrl,
  isUploading,
  sourceError,
}: AttachmentThumbnailPreviewProps) {
  const extension = getFileExtension(attachment.name);

  if (attachment.mediaType.startsWith("image/")) {
    return (
      <ImageAttachmentThumbnail
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading}
        sourceError={sourceError}
      />
    );
  }
  if (attachment.mediaType === "application/pdf" || extension === "pdf") {
    return sourceError ? (
      <GenericFileThumbnail attachment={attachment} isLoading={isUploading} hasError />
    ) : (
      <PdfAttachmentThumbnail
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading}
        sourceError={sourceError}
      />
    );
  }
  if (extension === "docx") {
    return fileUrl ? (
      <DocxAttachmentThumbnail
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading}
        sourceError={sourceError}
      />
    ) : (
      <GenericFileThumbnail
        attachment={attachment}
        isLoading={isUploading || !sourceError}
        hasError={sourceError}
      />
    );
  }
  if (extension === "pptx") {
    return fileUrl ? (
      <PptxAttachmentThumbnail
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading}
        sourceError={sourceError}
      />
    ) : (
      <GenericFileThumbnail
        attachment={attachment}
        isLoading={isUploading || !sourceError}
        hasError={sourceError}
      />
    );
  }
  if (extension === "xlsx") {
    return (
      <XlsxAttachmentThumbnailLoader
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading}
        sourceError={sourceError}
      />
    );
  }
  if (extension === "csv") {
    return sourceError ? (
      <GenericFileThumbnail attachment={attachment} isLoading={isUploading} hasError />
    ) : (
      <CsvAttachmentThumbnail
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading}
        sourceError={sourceError}
      />
    );
  }
  return (
    <GenericFileThumbnail
      attachment={attachment}
      isLoading={isUploading}
      hasError={sourceError}
    />
  );
}
