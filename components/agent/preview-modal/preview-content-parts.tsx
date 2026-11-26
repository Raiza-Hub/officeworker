"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import type { DocxViewerZoomApi } from "@/components/agent/docx-preview";
import type { PptxViewerZoomApi } from "@/components/agent/pptx-preview";
import { PreviewLoading } from "@/components/extend/preview-loading";
import type { PDFViewerZoomApi } from "@/components/extend/pdf-viewer";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import type { Editor as DocxEditorInstance } from "@docx-editor.dev/react";
import type { XlsxViewerSaveApi } from "@/lib/file-preview-types";
import type { CsvViewerSaveApi } from "@/components/extend/csv-viewer";
import type { PreviewKind } from "@/lib/file-types";
import type { PreviewContentState } from "./preview-content-utils";

const PdfPreview = dynamic(
  () =>
    import("@/components/agent/pdf-preview").then(
      (module) => module.PdfPreview,
    ),
  {
    ssr: false,
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
    import("@/components/agent/pptx-preview").then(
      (module) => module.PptxPreview,
    ),
  { ssr: false, loading: () => <PreviewLoading className="h-full w-full" /> },
);

const DocxPreview = dynamic(
  () =>
    import("@/components/agent/docx-preview").then(
      (module) => module.DocxPreview,
    ),
  { ssr: false, loading: () => <PreviewLoading className="h-full w-full" /> },
);

export type PreviewContentProps = {
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

export type PreviewContentBodyProps = PreviewContentProps & {
  state: PreviewContentState;
};

export function PreviewContentBody({
  state,
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
}: PreviewContentBodyProps) {
  switch (state.type) {
    case "hidden":
      return null;
    case "loading":
      return <PreviewLoading className="h-full w-full" />;
    case "pdf":
      return (
        <PdfContentView
          url={state.url}
          filename={filename}
          onLoaded={onLoaded}
          onZoomApi={onPdfZoomApi}
        />
      );
    case "spreadsheet":
      return (
        <SpreadsheetContentView
          state={state}
          xlsxEditable={xlsxEditable}
          csvEditable={csvEditable}
          onError={onError}
          onLoaded={onLoaded}
          onXlsxSaveApi={onXlsxSaveApi}
          onCsvSaveApi={onCsvSaveApi}
          csvZoom={csvZoom}
          onCsvZoomChange={onCsvZoomChange}
        />
      );
    case "pptx":
      return (
        <PptxContentView
          url={state.url}
          isContentLoading={isContentLoading}
          editable={pptxEditable}
          onLoaded={onLoaded}
          onError={onError}
          onZoomApi={onPptxZoomApi}
          onEditorReady={onPptxEditorReady}
        />
      );
    case "docx":
      return (
        <DocxContentView
          url={state.url}
          isContentLoading={isContentLoading}
          editable={docxEditable}
          onLoaded={onLoaded}
          onError={onError}
          onZoomApi={onDocxZoomApi}
          onEditorReady={onDocxEditorReady}
        />
      );
    case "image":
      return (
        <ImageView
          url={state.url}
          filename={filename}
          isContentLoading={isContentLoading}
          imageZoom={imageZoom}
          onLoaded={onLoaded}
          onError={onError}
        />
      );
  }
}

export function PdfContentView({
  url,
  filename,
  onLoaded,
  onZoomApi,
}: {
  url: string;
  filename: string;
  onLoaded: () => void;
  onZoomApi: (api: PDFViewerZoomApi | null) => void;
}) {
  return (
    <div className="relative h-full min-h-0 w-full">
      <PdfPreview
        src={url}
        filename={filename}
        onLoaded={onLoaded}
        onZoomApi={onZoomApi}
      />
    </div>
  );
}

export function SpreadsheetContentView({
  state,
  xlsxEditable,
  csvEditable,
  onError,
  onLoaded,
  onXlsxSaveApi,
  onCsvSaveApi,
  csvZoom,
  onCsvZoomChange,
}: {
  state: Extract<PreviewContentState, { type: "spreadsheet" }>;
  xlsxEditable: boolean;
  csvEditable: boolean;
  onError: (error: Error) => void;
  onLoaded: () => void;
  onXlsxSaveApi: (api: XlsxViewerSaveApi | null) => void;
  onCsvSaveApi: (api: CsvViewerSaveApi | null) => void;
  csvZoom: number;
  onCsvZoomChange: (zoom: number) => void;
}) {
  const isSheet = state.kind === "sheet";

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 self-stretch overflow-hidden">
      <SpreadsheetPreview
        key={state.url}
        src={state.url}
        kind={state.kind}
        editable={isSheet ? xlsxEditable : csvEditable}
        onError={onError}
        onLoaded={onLoaded}
        onSaveApi={isSheet ? onXlsxSaveApi : undefined}
        onCsvSaveApi={isSheet ? undefined : onCsvSaveApi}
        zoom={isSheet ? undefined : csvZoom}
        onZoomChange={isSheet ? undefined : onCsvZoomChange}
      />
    </div>
  );
}

export function PptxContentView({
  url,
  isContentLoading,
  editable,
  onLoaded,
  onError,
  onZoomApi,
  onEditorReady,
}: {
  url: string;
  isContentLoading: boolean;
  editable: boolean;
  onLoaded: () => void;
  onError: (error: Error) => void;
  onZoomApi: (api: PptxViewerZoomApi | null) => void;
  onEditorReady: (editor: PptxEditorInstance | null) => void;
}) {
  return (
    <div className="relative h-full min-h-0 w-full">
      {isContentLoading && (
        <PreviewLoading className="absolute inset-0 z-10 bg-white" />
      )}
      <PptxPreview
        key={url}
        src={url}
        editable={editable}
        onLoaded={onLoaded}
        onError={onError}
        onZoomApi={onZoomApi}
        onEditorReady={onEditorReady}
      />
    </div>
  );
}

export function DocxContentView({
  url,
  isContentLoading,
  editable,
  onLoaded,
  onError,
  onZoomApi,
  onEditorReady,
}: {
  url: string;
  isContentLoading: boolean;
  editable: boolean;
  onLoaded: () => void;
  onError: (error: Error) => void;
  onZoomApi: (api: DocxViewerZoomApi | null) => void;
  onEditorReady: (editor: DocxEditorInstance | null) => void;
}) {
  return (
    <div className="relative h-full min-h-0 w-full">
      {isContentLoading && (
        <PreviewLoading className="absolute inset-0 z-10 bg-white" />
      )}
      <DocxPreview
        key={url}
        src={url}
        editable={editable}
        onLoaded={onLoaded}
        onError={onError}
        onZoomApi={onZoomApi}
        onEditorReady={onEditorReady}
      />
    </div>
  );
}

export function ImageView({
  url,
  filename,
  isContentLoading,
  imageZoom,
  onLoaded,
  onError,
}: {
  url: string;
  filename: string;
  isContentLoading: boolean;
  imageZoom: number;
  onLoaded: () => void;
  onError: (error: Error) => void;
}) {
  return (
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
          src={url}
          alt={filename}
          width={0}
          height={0}
          sizes="100vw"
          unoptimized
          onLoad={onLoaded}
          onError={() => onError(new Error("Could not display this image"))}
          className="max-h-full max-w-full h-auto w-auto object-contain"
        />
      </div>
    </div>
  );
}
