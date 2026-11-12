"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import type { DocxViewerZoomApi } from "@/components/agent/docx-preview";
import type { PptxViewerZoomApi } from "@/components/agent/pptx-preview";
import { PreviewLoading } from "@/components/extend/preview-loading";
import type { PDFViewerZoomApi } from "@/components/extend/pdf-viewer";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import type { Editor as DocxEditorInstance } from "@docx-editor.dev/react";
import type { XlsxViewerSaveApi } from "@/components/agent/spreadsheet-preview";
import type { CsvViewerSaveApi } from "@/components/extend/csv-viewer";
import type { PreviewKind } from "@/lib/file-types";

const PdfPreview = dynamic(
  () =>
    import("@/components/agent/pdf-preview").then((module) => module.PdfPreview),
  {
    ssr: false,
    // PDF rendering uses browser APIs and stays in the client bundle.
    loading: () => <PreviewLoading className="h-full w-full" />,
  },
);

const SpreadsheetPreview = dynamic(
  () =>
    import("@/components/agent/spreadsheet-preview").then(
      (module) => module.SpreadsheetPreview,
    ),
  { ssr: false, loading: () => <PreviewLoading className="h-full w-full" /> },
);

const PptxPreview = dynamic(
  () =>
    import("@/components/agent/pptx-preview").then((module) => module.PptxPreview),
  { ssr: false, loading: () => <PreviewLoading className="h-full w-full" /> },
);

const DocxPreview = dynamic(
  () =>
    import("@/components/agent/docx-preview").then((module) => module.DocxPreview),
  { ssr: false, loading: () => <PreviewLoading className="h-full w-full" /> },
);

type PreviewContentProps = {
  open: boolean;
  previewUrl: string | null;
  kind: PreviewKind;
  filename: string;
  isContentLoading: boolean;
  docxEditable: boolean;
  pptxEditable: boolean;
  xlsxEditable: boolean;
  csvEditable: boolean;
  csvZoom: number;
  onCsvZoomChange: (zoom: number) => void;
  imageZoom: number;
  onPdfZoomApi: (api: PDFViewerZoomApi | null) => void;
  onPptxZoomApi: (api: PptxViewerZoomApi | null) => void;
  onDocxZoomApi: (api: DocxViewerZoomApi | null) => void;
  onPptxEditorReady: (editor: PptxEditorInstance | null) => void;
  onDocxEditorReady: (editor: DocxEditorInstance | null) => void;
  onXlsxSaveApi: (api: XlsxViewerSaveApi | null) => void;
  onCsvSaveApi: (api: CsvViewerSaveApi | null) => void;
  onLoaded: () => void;
  onError: (error: Error) => void;
};

export function PreviewContent({
  open,
  previewUrl,
  kind,
  filename,
  isContentLoading,
  docxEditable,
  pptxEditable,
  xlsxEditable,
  csvEditable,
  csvZoom,
  onCsvZoomChange,
  imageZoom,
  onPdfZoomApi,
  onPptxZoomApi,
  onDocxZoomApi,
  onPptxEditorReady,
  onDocxEditorReady,
  onXlsxSaveApi,
  onCsvSaveApi,
  onLoaded,
  onError,
}: PreviewContentProps) {
  return (
    <main
      className="flex min-h-0 min-w-0 flex-1 items-stretch justify-center overflow-hidden bg-white p-2 print:overflow-visible print:p-0"
      onClick={(event) => event.stopPropagation()}
    >
      {!open && !previewUrl ? null : open && !previewUrl ? (
        <PreviewLoading className="h-full w-full" />
      ) : kind === "pdf" && previewUrl ? (
        <div className="relative h-full min-h-0 w-full">
          <PdfPreview
            src={previewUrl}
            filename={filename}
            onLoaded={onLoaded}
            onZoomApi={onPdfZoomApi}
          />
        </div>
      ) : (kind === "csv" || kind === "sheet") && previewUrl ? (
        <div className="flex min-h-0 min-w-0 w-full flex-1 self-stretch overflow-hidden">
          <SpreadsheetPreview
            key={previewUrl}
            src={previewUrl}
            kind={kind}
            editable={
              kind === "sheet"
                ? xlsxEditable
                : kind === "csv"
                  ? csvEditable
                  : false
            }
            onError={onError}
            onLoaded={onLoaded}
            onSaveApi={kind === "sheet" ? onXlsxSaveApi : undefined}
            onCsvSaveApi={kind === "csv" ? onCsvSaveApi : undefined}
            zoom={kind === "csv" ? csvZoom : undefined}
            onZoomChange={kind === "csv" ? onCsvZoomChange : undefined}
          />
        </div>
      ) : kind === "pptx" && previewUrl ? (
        <div className="relative h-full min-h-0 w-full">
          {isContentLoading && (
            <PreviewLoading className="absolute inset-0 z-10 bg-white" />
          )}
          <PptxPreview
            key={previewUrl}
            src={previewUrl}
            editable={pptxEditable}
            onLoaded={onLoaded}
            onError={onError}
            onZoomApi={onPptxZoomApi}
            onEditorReady={onPptxEditorReady}
          />
        </div>
      ) : kind === "docx" && previewUrl ? (
        <div className="relative h-full min-h-0 w-full">
          {isContentLoading && (
            <PreviewLoading className="absolute inset-0 z-10 bg-white" />
          )}
          <DocxPreview
            key={previewUrl}
            src={previewUrl}
            editable={docxEditable}
            onLoaded={onLoaded}
            onError={onError}
            onZoomApi={onDocxZoomApi}
            onEditorReady={onDocxEditorReady}
          />
        </div>
      ) : kind === "image" ? (
        <div
          className="relative flex min-h-0 w-full flex-1 items-center justify-center self-stretch overflow-auto"
          aria-label={`${filename} image preview`}
        >
          {isContentLoading && (
            <PreviewLoading className="absolute inset-0 bg-white" />
          )}
          <div
            className="flex h-full w-full origin-center items-center justify-center transition-transform duration-150"
            style={{ transform: `scale(${imageZoom})` }}
          >
            <Image
              src={previewUrl!}
              alt={filename}
              width={0}
              height={0}
              sizes="100vw"
              unoptimized
              onLoad={onLoaded}
              onError={() =>
                onError(new Error("Could not display this image"))
              }
              className="max-h-full max-w-full h-auto w-auto object-contain"
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
