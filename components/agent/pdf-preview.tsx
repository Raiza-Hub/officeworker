"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const DEFAULT_PAGE_WIDTH = 794;

export function PdfPreview({
  src,
  zoom,
  onError,
  onLoaded,
}: {
  src: string | undefined;
  zoom: number;
  onError: (error: Error) => void;
  onLoaded?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(DEFAULT_PAGE_WIDTH);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleLoadSuccess = useCallback(
    ({ numPages: pageCount }: { numPages: number }) => {
      setNumPages(pageCount);
      onLoaded?.();
    },
    [onLoaded],
  );

  const pageWidth = Math.round(
    Math.max(
      240,
      Math.min(DEFAULT_PAGE_WIDTH, containerWidth - 16) * (zoom / 100),
    ),
  );

  return (
    <div
      ref={containerRef}
      id="attachment-preview-pages"
      className="flex min-h-full w-full flex-col items-center gap-2 overflow-auto bg-white"
    >
      <Document
        file={src}
        suspense={false}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={(error) => {
          onLoaded?.();
          onError(error);
        }}
        loading={
          <div className="flex h-full min-h-[300px] w-full items-center justify-center gap-2 text-[13px] text-[#85878e]">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-[#626bd9]"
            />
            <span>Loading preview…</span>
          </div>
        }
        error={null}
        noData={null}
      >
        {Array.from({ length: numPages }, (_, index) => (
          <Page
            key={`page-${index + 1}`}
            pageNumber={index + 1}
            width={pageWidth}
            devicePixelRatio={Math.min(2, window.devicePixelRatio)}
            suspense={false}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onRenderError={onError}
            className="border-[0.5px] border-[#e7e7e7] bg-white"
          />
        ))}
      </Document>
    </div>
  );
}
