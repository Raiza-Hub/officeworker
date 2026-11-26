import type { AttachmentThumbnailPreviewProps } from "./types";

export type ThumbnailKind =
  | "image"
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "csv"
  | "generic";

export function resolveThumbnailKind(
  attachment: AttachmentThumbnailPreviewProps["attachment"],
  extension: string,
): ThumbnailKind {
  if (attachment.mediaType.startsWith("image/")) return "image";
  if (attachment.mediaType === "application/pdf" || extension === "pdf") {
    return "pdf";
  }
  if (
    extension === "docx" ||
    extension === "pptx" ||
    extension === "xlsx" ||
    extension === "csv"
  ) {
    return extension;
  }
  return "generic";
}
