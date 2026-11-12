"use client";

import { useEffect, useState } from "react";
import {
  createPptxThumbnailRenderer,
  parsePresentation,
} from "@extend-ai/react-pptx";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import type { AttachmentThumbnailPreviewProps } from "./types";

export function PptxAttachmentThumbnail({
  attachment,
  fileUrl,
  isUploading,
}: AttachmentThumbnailPreviewProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    let renderer: ReturnType<typeof createPptxThumbnailRenderer> | null = null;
    void (async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Could not load this presentation");
        const buffer = await response.arrayBuffer();
        const presentation = await parsePresentation(buffer);
        if (cancelled) return;
        renderer = createPptxThumbnailRenderer(presentation);
        const result = await renderer.renderSlide(0, {
          maxWidth: 240,
          maxHeight: 324,
          output: "blob",
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(result.data);
        setCoverUrl(objectUrl);
      } catch {
        if (!cancelled) setHasError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      renderer?.destroy();
    };
  }, [attachment.name, fileUrl]);

  return (
    <FileThumbnail
      file={{ name: attachment.name, type: attachment.mediaType }}
      previewAspectRatio={1}
      previewClassName="bg-white [&>img]:object-cover [&>img]:object-top"
      previewImageUrl={coverUrl}
      isLoading={isUploading || (!coverUrl && !hasError)}
      hasError={hasError}
      className="w-full rounded-md border-0 bg-transparent shadow-none"
    />
  );
}
