"use client";

import { useEffect, useState } from "react";
import {
  CsvViewer,
  type CsvViewerSaveApi,
} from "@/components/extend/csv-viewer";
import { PreviewLoading } from "@/components/extend/preview-loading";
import { loadCsvPreview } from "./preview-file-loader";

export function CsvPreview({
  src,
  editable,
  onError,
  onLoaded,
  onSaveApi,
  zoom,
  onZoomChange,
}: {
  src: string;
  editable: boolean;
  onError: (error: Error) => void;
  onLoaded?: () => void;
  onSaveApi?: (api: CsvViewerSaveApi | null) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}) {
  const [data, setData] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadCsvPreview(src, controller.signal)
      .then((text) => {
        if (controller.signal.aborted) return;
        setData(text);
        onLoaded?.();
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Could not display this file";
        setLoadError(message);
        onError(error instanceof Error ? error : new Error(message));
      });
    return () => {
      controller.abort();
    };
  }, [src, onError, onLoaded]);

  if (loadError) {
    return (
      <div className="flex h-full min-h-75 w-full items-center justify-center text-[13px] text-muted-foreground">
        <span>{loadError}</span>
      </div>
    );
  }

  if (!data) {
    return <PreviewLoading />;
  }

  return (
    <div className="h-full min-h-0 w-full min-w-0">
      <CsvViewer
        data={data}
        editable={editable}
        className="h-full w-full"
        showToolbar={false}
        zoom={zoom}
        onZoomChange={onZoomChange}
        onSaveApi={onSaveApi}
      />
    </div>
  );
}
