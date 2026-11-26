"use client";

import { getFileExtension } from "@/lib/file-types";
import { resolveThumbnailKind } from "./thumbnail-kind";
import { ThumbnailVariant } from "./thumbnail-variants";
import type { AttachmentThumbnailPreviewProps } from "./types";

export function AttachmentThumbnailPreview(
  props: AttachmentThumbnailPreviewProps,
) {
  const kind = resolveThumbnailKind(
    props.attachment,
    getFileExtension(props.attachment.name),
  );
  return <ThumbnailVariant kind={kind} {...props} />;
}
