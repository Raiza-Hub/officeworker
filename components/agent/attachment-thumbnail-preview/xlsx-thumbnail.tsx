"use client";

import { useEffect, useRef, useState } from "react";
import {
  setWasmSource,
  useXlsxViewerController,
  useXlsxViewerThumbnails,
  XlsxViewerProvider,
} from "@extend-ai/react-xlsx";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import { GenericFileThumbnail } from "./generic-thumbnail";
import type { AttachmentThumbnailPreviewProps } from "./types";

setWasmSource("/duke_sheets_wasm_bg.wasm");

function XlsxThumbnailCapture({
  attachment,
  isUploading,
}: {
  attachment: { name: string; mediaType: string };
  isUploading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { thumbnails } = useXlsxViewerThumbnails({
    includeHeaders: true,
    resolution: { maxHeight: 520, maxWidth: 520 },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const thumbnail = thumbnails[0];
    if (!canvas || !thumbnail) return;
    canvas.width = thumbnail.width;
    canvas.height = thumbnail.height;
    thumbnail.paint(canvas);
  }, [thumbnails]);

  return (
    <FileThumbnail
      file={{ name: attachment.name, type: attachment.mediaType }}
      previewAspectRatio={1}
      previewClassName="bg-white"
      previewContent={
        <canvas ref={canvasRef} className="size-full bg-white object-left-top" />
      }
      isLoading={isUploading || thumbnails.length === 0}
      className="w-full rounded-md border-0 bg-transparent shadow-none"
    />
  );
}

function XlsxAttachmentThumbnail({
  attachment,
  workbookBuffer,
  isUploading,
}: {
  attachment: { name: string; mediaType: string };
  workbookBuffer: ArrayBuffer;
  isUploading: boolean;
}) {
  const controller = useXlsxViewerController({
    file: workbookBuffer,
    fileName: attachment.name,
    readOnly: true,
    useWorker: true,
  });

  return (
    <XlsxViewerProvider controller={controller}>
      <XlsxThumbnailCapture attachment={attachment} isUploading={isUploading} />
    </XlsxViewerProvider>
  );
}

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
    let current = true;
    void fetch(fileUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load this workbook");
        return response.arrayBuffer();
      })
      .then((nextBuffer) => {
        if (current) setBuffer(nextBuffer);
      })
      .catch(() => {
        if (current) setHasError(true);
      });
    return () => {
      current = false;
    };
  }, [fileUrl]);

  if (sourceError || hasError) {
    return <GenericFileThumbnail attachment={attachment} isLoading={isUploading} hasError />;
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
