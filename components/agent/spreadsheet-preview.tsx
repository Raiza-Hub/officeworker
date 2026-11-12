"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  setWasmSource,
  useXlsxViewerController,
  XlsxViewer,
  type XlsxCellStyleContext,
} from "@extend-ai/react-xlsx";
import {
  CsvViewer,
  type CsvViewerSaveApi,
} from "@/components/extend/csv-viewer";
import { PreviewLoading } from "@/components/extend/preview-loading";

setWasmSource("/duke_sheets_wasm_bg.wasm");

export type XlsxViewerSaveApi = {
  getBytes: () => Uint8Array | null;
};

function getXlsxCellStyle({ resolvedStyle }: XlsxCellStyleContext) {
  const decoration = resolvedStyle.textDecoration;
  if (typeof decoration !== "string" || !decoration.includes("line-through")) {
    return undefined;
  }
  const remainingDecorations = decoration
    .split(/\s+/)
    .filter((value) => value !== "line-through");
  return {
    textDecoration: remainingDecorations.length
      ? remainingDecorations.join(" ")
      : "none",
  };
}

function SheetPreview({
  bytes,
  editable,
  onLoaded,
  onSaveApi,
}: {
  bytes: ArrayBuffer;
  editable: boolean;
  onLoaded?: () => void;
  onSaveApi?: (api: XlsxViewerSaveApi | null) => void;
}) {
  const controller = useXlsxViewerController({
    file: bytes,
    readOnly: !editable,
    useWorker: false,
  });
  const controllerRef = useRef(controller);
  const loadedRef = useRef(false);
  const saveApi = useMemo<XlsxViewerSaveApi>(
    () => ({
      getBytes: () => controllerRef.current.getXlsxBytes(),
    }),
    [],
  );

  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  useEffect(() => {
    onSaveApi?.(saveApi);
    return () => onSaveApi?.(null);
  }, [onSaveApi, saveApi]);

  useEffect(() => {
    if (loadedRef.current || controller.isLoading || !controller.workbook) {
      return;
    }
    loadedRef.current = true;
    onLoaded?.();
  }, [controller.isLoading, controller.workbook, onLoaded]);

  return (
    <div className="h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
      <XlsxViewer
        controller={controller}
        getCellStyle={getXlsxCellStyle}
        className="h-full w-full"
        height="100%"
        showDefaultToolbar={false}
        loadingState={<PreviewLoading />}
        errorState={(error) => (
          <div role="alert" className="flex h-full min-h-[300px] w-full items-center justify-center px-6 text-center text-[13px] text-[#85878e]">
            {error.message || "Could not display this spreadsheet"}
          </div>
        )}
      />
    </div>
  );
}

function CsvPreview({
  src,
  editable,
  onError,
  onLoaded,
  onSaveApi,
  zoom,
  onZoomChange,
}: {
  src: string
  editable: boolean
  onError: (error: Error) => void
  onLoaded?: () => void
  onSaveApi?: (api: CsvViewerSaveApi | null) => void
  zoom?: number
  onZoomChange?: (zoom: number) => void
}) {
  const [data, setData] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Failed to download file for preview");
        }
        const text = (await response.text()).replace(/^\uFEFF/, "");
        if (!text.trim()) throw new Error("This spreadsheet is empty");
        if (controller.signal.aborted) return;
        setData(text);
        onLoaded?.();
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Could not display this file";
        setLoadError(message);
        onError(
          error instanceof Error ? error : new Error(message),
        );
      }
    })();
    return () => {
      controller.abort();
    };
  }, [src, onError, onLoaded]);

  if (loadError) {
    return (
      <div className="flex h-full min-h-[300px] w-full items-center justify-center text-[13px] text-[#85878e]">
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
  src: string
  kind: "csv" | "sheet"
  editable?: boolean
  onError: (error: Error) => void
  onLoaded?: () => void
  onSaveApi?: (api: XlsxViewerSaveApi | null) => void
  onCsvSaveApi?: (api: CsvViewerSaveApi | null) => void
  zoom?: number
  onZoomChange?: (zoom: number) => void
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
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full min-h-[300px] w-full items-center justify-center text-[13px] text-[#85878e]">
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
