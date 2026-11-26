"use client";

import { useEffect, useRef } from "react";
import {
  setWasmSource,
  useXlsxViewerController,
  useXlsxViewerThumbnails,
  XlsxViewerProvider,
} from "@extend-ai/react-xlsx";
import { FileThumbnail } from "@/components/extend/file-thumbnail";

setWasmSource("/duke_sheets_wasm_bg.wasm");

export function XlsxThumbnailCapture({
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

export function XlsxAttachmentThumbnail({
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
