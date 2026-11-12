"use client";

import { PDFViewer, type PDFViewerZoomApi } from "@/components/extend/pdf-viewer";

export function PdfPreview({
  src,
  filename,
  onLoaded,
  onZoomApi,
}: {
  src: string;
  filename: string;
  onLoaded?: () => void;
  onZoomApi?: (api: PDFViewerZoomApi | null) => void;
}) {
  return (
    <PDFViewer
      src={src}
      fileName={filename}
      defaultZoom="automatic"
      showToolbar={false}
      showUpload={false}
      showDownload={false}
      showRotateControls={false}
      className="h-full w-full"
      onDocumentLoadSuccess={() => onLoaded?.()}
      onZoomApi={onZoomApi}
    />
  );
}
