"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useXlsxViewerController,
  XlsxViewer,
} from "@extend-ai/react-xlsx";
import { PreviewLoading } from "@/components/extend/preview-loading";
import type { XlsxViewerSaveApi } from "@/lib/file-preview-types";
import { getXlsxCellStyle } from "./spreadsheet-preview-utils";

export function SheetPreview({
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
          <div role="alert" className="flex h-full min-h-75 w-full items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
            {error.message || "Could not display this spreadsheet"}
          </div>
        )}
      />
    </div>
  );
}
