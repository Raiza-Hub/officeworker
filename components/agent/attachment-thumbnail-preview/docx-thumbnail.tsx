"use client";

import { useEffect, useState } from "react";
import {
  createDocxThumbnailRenderer,
  parseDocxForViewer,
} from "@extend-ai/react-docx";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import type { AttachmentThumbnailPreviewProps } from "./types";

export function DocxAttachmentThumbnail({
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
    let renderer: ReturnType<typeof createDocxThumbnailRenderer> | null = null;
    void (async () => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Could not load this document");
        const buffer = await response.arrayBuffer();
        const document = await parseDocxForViewer(buffer, {
          fileName: attachment.name,
        });
        if (cancelled) {
          document.dispose();
          return;
        }
        renderer = createDocxThumbnailRenderer(document, {
          scheduling: "immediate",
          pixelRatio: 2,
          pageIndexes: [0],
        });
        const result = await renderer.renderPage(0, {
          maxWidth: 240,
          maxHeight: 324,
          output: "blob",
        });
        if (cancelled) return;
        if (result.blob) {
          objectUrl = URL.createObjectURL(result.blob);
          setCoverUrl(objectUrl);
        } else {
          setHasError(true);
        }
      } catch {
        if (!cancelled) setHasError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const currentRenderer = renderer;
      setTimeout(() => {
        currentRenderer?.dispose();
      }, 0);
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
