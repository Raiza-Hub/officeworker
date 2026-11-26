"use client";

import { useEffect, useRef, useState } from "react";
import { setWasmSource } from "@extend-ai/react-xlsx";
import type {
  CsvViewerSaveApi,
} from "@/components/extend/csv-viewer";
import { PreviewLoading } from "@/components/extend/preview-loading";
import type { XlsxViewerSaveApi } from "@/lib/file-preview-types";
import { CsvPreview } from "./csv-preview";
import { SheetPreview } from "./sheet-preview";

setWasmSource("/duke_sheets_wasm_bg.wasm");

export function SpreadsheetPreview({
  src,
  kind,
  editable = false,
  onError,
  onLoaded,
  onSaveApi,
  onCsvSaveApi,
  zoom,
  onZoomChange,
}: {
  src: string;
  kind: "csv" | "sheet";
  editable?: boolean;
  onError: (error: Error) => void;
  onLoaded?: () => void;
  onSaveApi?: (api: XlsxViewerSaveApi | null) => void;
  onCsvSaveApi?: (api: CsvViewerSaveApi | null) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}) {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (kind !== "sheet") return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error("Failed to download spreadsheet for preview");
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        setBytes(buffer);
      } catch (error) {
        if (cancelled) return;
        const err = error instanceof Error ? error : new Error("Could not display this spreadsheet");
        setLoadError(err.message);
        onErrorRef.current(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, kind]);

  if (kind === "csv") {
    return (
      <CsvPreview
        src={src}
        editable={editable}
        onError={onError}
        onLoaded={onLoaded}
        onSaveApi={onCsvSaveApi}
        zoom={zoom}
        onZoomChange={onZoomChange}
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full min-h-75 w-full items-center justify-center text-[13px] text-muted-foreground">
        <span>{loadError}</span>
      </div>
    );
  }

  if (!bytes) {
    return <PreviewLoading />;
  }

  return (
    <SheetPreview
      key={src}
      bytes={bytes}
      editable={editable}
      onLoaded={onLoaded}
      onSaveApi={onSaveApi}
    />
  );
}
