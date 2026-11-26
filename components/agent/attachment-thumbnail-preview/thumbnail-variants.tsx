"use client";

import { CsvAttachmentThumbnail } from "./csv-thumbnail";
import { DocxAttachmentThumbnail } from "./docx-thumbnail";
import { GenericFileThumbnail } from "./generic-thumbnail";
import { ImageAttachmentThumbnail } from "./image-thumbnail";
import { PdfAttachmentThumbnail } from "./pdf-thumbnail";
import { PptxAttachmentThumbnail } from "./pptx-thumbnail";
import type { AttachmentThumbnailPreviewProps } from "./types";
import type { ThumbnailKind } from "./thumbnail-kind";
import { XlsxAttachmentThumbnailLoader } from "./xlsx-thumbnail";

export function GenericThumbnail({
  attachment,
  isUploading,
  sourceError,
}: AttachmentThumbnailPreviewProps) {
  return (
    <GenericFileThumbnail
      attachment={attachment}
      isLoading={isUploading}
      hasError={sourceError}
    />
  );
}

export function PdfThumbnail({
  sourceError,
  ...props
}: AttachmentThumbnailPreviewProps) {
  return sourceError ? (
    <GenericFileThumbnail
      attachment={props.attachment}
      isLoading={props.isUploading}
      hasError
    />
  ) : (
    <PdfAttachmentThumbnail {...props} sourceError={sourceError} />
  );
}

export function DocxThumbnail({
  fileUrl,
  ...props
}: AttachmentThumbnailPreviewProps) {
  return fileUrl ? (
    <DocxAttachmentThumbnail {...props} fileUrl={fileUrl} />
  ) : (
    <GenericFileThumbnail
      attachment={props.attachment}
      isLoading={props.isUploading || !props.sourceError}
      hasError={props.sourceError}
    />
  );
}

export function PptxThumbnail({
  fileUrl,
  ...props
}: AttachmentThumbnailPreviewProps) {
  return fileUrl ? (
    <PptxAttachmentThumbnail {...props} fileUrl={fileUrl} />
  ) : (
    <GenericFileThumbnail
      attachment={props.attachment}
      isLoading={props.isUploading || !props.sourceError}
      hasError={props.sourceError}
    />
  );
}

export function CsvThumbnail({
  sourceError,
  ...props
}: AttachmentThumbnailPreviewProps) {
  return sourceError ? (
    <GenericFileThumbnail
      attachment={props.attachment}
      isLoading={props.isUploading}
      hasError
    />
  ) : (
    <CsvAttachmentThumbnail {...props} sourceError={sourceError} />
  );
}

export function ThumbnailVariant({
  kind,
  ...props
}: { kind: ThumbnailKind } & AttachmentThumbnailPreviewProps) {
  switch (kind) {
    case "image":
      return <ImageAttachmentThumbnail {...props} />;
    case "pdf":
      return <PdfThumbnail {...props} />;
    case "docx":
      return <DocxThumbnail {...props} />;
    case "pptx":
      return <PptxThumbnail {...props} />;
    case "xlsx":
      return <XlsxAttachmentThumbnailLoader {...props} />;
    case "csv":
      return <CsvThumbnail {...props} />;
    case "generic":
      return <GenericThumbnail {...props} />;
  }
}
