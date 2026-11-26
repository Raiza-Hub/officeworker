"use client";

import type { DocxViewerZoomApi } from "@/components/agent/docx-preview";
import type { PDFViewerZoomApi } from "@/components/extend/pdf-viewer";
import type { PptxViewerZoomApi } from "@/components/agent/pptx-preview";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import type { PreviewKind } from "@/lib/file-types";
import type { EditToggleState } from "./preview-toolbar-types";
import {
  CsvZoomControl,
  DocxZoomControl,
  EditToggleButton,
  ImageZoomControl,
  PdfZoomControl,
  PptxViewToggle,
  PptxZoomControl,
  ToolbarFileActions,
} from "./preview-toolbar-controls";

export type { EditToggleState } from "./preview-toolbar-types";

type PreviewToolbarProps = {
  filename: string;
  kind: PreviewKind;
  isContentLoading: boolean;
  isDownloading: boolean;
  previewUrl: string | null;
  canDownload: boolean;
  pdfZoomApi: PDFViewerZoomApi | null;
  pptxZoomApi: PptxViewerZoomApi | null;
  pptxView: "normal" | "slideSorter";
  pptxEditor: PptxEditorInstance | null;
  docxZoomApi: DocxViewerZoomApi | null;
  csvZoom: number;
  onCsvZoomChange: (zoom: number) => void;
  imageZoom: number;
  onImageZoomChange: (zoom: number) => void;
  editToggle: EditToggleState | null;
  onDownload: () => void;
  onCopyLink: () => void;
  onClose: () => void;
};

export function PreviewToolbar({
  filename,
  kind,
  isContentLoading,
  isDownloading,
  previewUrl,
  canDownload,
  pdfZoomApi,
  pptxZoomApi,
  pptxView,
  pptxEditor,
  docxZoomApi,
  csvZoom,
  onCsvZoomChange,
  imageZoom,
  onImageZoomChange,
  editToggle,
  onDownload,
  onCopyLink,
  onClose,
}: PreviewToolbarProps) {
  return (
    <header
      id="attachment-preview-toolbar"
      onClick={(event) => event.stopPropagation()}
      className="z-10 flex h-11 min-h-11 shrink-0 items-center justify-between gap-3 border-b border-[#eeeeef] bg-white px-3 sm:px-4 print:hidden"
    >
      <div className="flex min-w-0 items-center">
        <span className="truncate text-[13px] font-medium text-ink-soft">
          {filename}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <PdfZoomControl
          kind={kind}
          isContentLoading={isContentLoading}
          pdfZoomApi={pdfZoomApi}
        />
        <PptxZoomControl
          kind={kind}
          isContentLoading={isContentLoading}
          pptxView={pptxView}
          pptxZoomApi={pptxZoomApi}
        />
        <DocxZoomControl
          kind={kind}
          isContentLoading={isContentLoading}
          docxZoomApi={docxZoomApi}
        />
        <CsvZoomControl
          kind={kind}
          isContentLoading={isContentLoading}
          csvZoom={csvZoom}
          onCsvZoomChange={onCsvZoomChange}
        />
        <ImageZoomControl
          kind={kind}
          isContentLoading={isContentLoading}
          imageZoom={imageZoom}
          onImageZoomChange={onImageZoomChange}
        />
        <PptxViewToggle
          kind={kind}
          isContentLoading={isContentLoading}
          pptxView={pptxView}
          pptxEditor={pptxEditor}
        />
        <EditToggleButton editToggle={editToggle} />
        <ToolbarFileActions
          isDownloading={isDownloading}
          previewUrl={previewUrl}
          canDownload={canDownload}
          onDownload={onDownload}
          onCopyLink={onCopyLink}
          onClose={onClose}
        />
      </div>
    </header>
  );
}
