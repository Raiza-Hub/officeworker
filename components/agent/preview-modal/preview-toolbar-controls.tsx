"use client";

import {
  CircleMinus,
  CirclePlusIcon,
  Download,
  Eye,
  LayoutGrid,
  Link2,
  LoaderCircle,
  Maximize,
  Pencil,
  Presentation,
  Printer,
  X,
} from "lucide-react";
import type { DocxViewerZoomApi } from "@/components/agent/docx-preview";
import type { PDFViewerZoomApi } from "@/components/extend/pdf-viewer";
import type { PptxViewerZoomApi } from "@/components/agent/pptx-preview";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import { CSV_ZOOM_OPTIONS } from "@/components/extend/csv-viewer/csv-constants";
import type { PreviewKind } from "@/lib/file-types";
import { stepCsvZoom, stepImageZoom } from "./preview-toolbar-utils";

export function PdfZoomControl({
  kind,
  isContentLoading,
  pdfZoomApi,
}: {
  kind: PreviewKind;
  isContentLoading: boolean;
  pdfZoomApi: PDFViewerZoomApi | null;
}) {
  return kind === "pdf" && pdfZoomApi && !isContentLoading ? (
    <div className="mr-1 flex items-center gap-0.5 border-r border-[#eeeeef] pr-2">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={pdfZoomApi.canZoomOut === false}
        onClick={() => pdfZoomApi.zoomOut?.()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-text-dim-soft">
        {Math.round(pdfZoomApi.zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={pdfZoomApi.canZoomIn === false}
        onClick={() => pdfZoomApi.zoomIn?.()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        aria-label="Fit page"
        title="Fit page"
        onClick={() => pdfZoomApi.fit?.()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </div>
  ) : null;
}

export function PptxZoomControl({
  kind,
  isContentLoading,
  pptxView,
  pptxZoomApi,
}: {
  kind: PreviewKind;
  isContentLoading: boolean;
  pptxView: "normal" | "slideSorter";
  pptxZoomApi: PptxViewerZoomApi | null;
}) {
  return kind === "pptx" &&
    pptxZoomApi &&
    !isContentLoading &&
    pptxView !== "slideSorter" ? (
    <div className="mr-1 flex items-center gap-0.5 border-r border-[#eeeeef] pr-2">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={!pptxZoomApi.canZoomOut}
        onClick={() => pptxZoomApi.zoomOut()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-text-dim-soft">
        {Math.round(pptxZoomApi.zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={!pptxZoomApi.canZoomIn}
        onClick={() => pptxZoomApi.zoomIn()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        aria-label="Fit slide"
        title="Fit slide"
        onClick={() => pptxZoomApi.fit()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </div>
  ) : null;
}

export function DocxZoomControl({
  kind,
  isContentLoading,
  docxZoomApi,
}: {
  kind: PreviewKind;
  isContentLoading: boolean;
  docxZoomApi: DocxViewerZoomApi | null;
}) {
  return kind === "docx" && docxZoomApi && !isContentLoading ? (
    <div className="mr-1 flex items-center gap-0.5 border-r border-[#eeeeef] pr-2">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={!docxZoomApi.canZoomOut}
        onClick={() => docxZoomApi.zoomOut()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-text-dim-soft">
        {Math.round(docxZoomApi.zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={!docxZoomApi.canZoomIn}
        onClick={() => docxZoomApi.zoomIn()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        aria-label="Fit page width"
        title="Fit page width"
        onClick={() => docxZoomApi.auto()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </div>
  ) : null;
}

export function CsvZoomControl({
  kind,
  isContentLoading,
  csvZoom,
  onCsvZoomChange,
}: {
  kind: PreviewKind;
  isContentLoading: boolean;
  csvZoom: number;
  onCsvZoomChange: (zoom: number) => void;
}) {
  return kind === "csv" && !isContentLoading ? (
    <div className="mr-1 flex items-center gap-0.5 border-r border-[#eeeeef] pr-2">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={csvZoom <= CSV_ZOOM_OPTIONS[0]}
        onClick={() => stepCsvZoom(csvZoom, -1, onCsvZoomChange)}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-text-dim-soft">{Math.round(csvZoom * 100)}%</span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={csvZoom >= CSV_ZOOM_OPTIONS[CSV_ZOOM_OPTIONS.length - 1]}
        onClick={() => stepCsvZoom(csvZoom, 1, onCsvZoomChange)}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </div>
  ) : null;
}

export function ImageZoomControl({
  kind,
  isContentLoading,
  imageZoom,
  onImageZoomChange,
}: {
  kind: PreviewKind;
  isContentLoading: boolean;
  imageZoom: number;
  onImageZoomChange: (zoom: number) => void;
}) {
  return kind === "image" && !isContentLoading ? (
    <div className="mr-1 flex items-center gap-0.5 border-r border-[#eeeeef] pr-2">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={imageZoom <= 0.25}
        onClick={() => stepImageZoom(imageZoom, -1, onImageZoomChange)}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-text-dim-soft">
        {Math.round(imageZoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={imageZoom >= 4}
        onClick={() => stepImageZoom(imageZoom, 1, onImageZoomChange)}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        aria-label="Fit image"
        title="Fit image"
        disabled={imageZoom === 1}
        onClick={() => onImageZoomChange(1)}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </div>
  ) : null;
}

export function PptxViewToggle({
  kind,
  isContentLoading,
  pptxView,
  pptxEditor,
}: {
  kind: PreviewKind;
  isContentLoading: boolean;
  pptxView: "normal" | "slideSorter";
  pptxEditor: PptxEditorInstance | null;
}) {
  return kind === "pptx" && pptxEditor && !isContentLoading ? (
    <button
      type="button"
      aria-label="Toggle slide sorter view"
      aria-pressed={pptxView === "slideSorter"}
      title={pptxView === "slideSorter" ? "Normal view" : "Slide sorter"}
      onClick={() =>
        pptxEditor.exec({
          type: "setPresentationView",
          view: pptxView === "slideSorter" ? "normal" : "slideSorter",
        })
      }
      className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pptxView === "slideSorter" ? (
        <LayoutGrid aria-hidden="true" className="size-3.5 shrink-0" />
      ) : (
        <Presentation aria-hidden="true" className="size-3.5 shrink-0" />
      )}
    </button>
  ) : null;
}

export function EditToggleButton({
  editToggle,
}: {
  editToggle: { editable: boolean; toggle: () => void } | null;
}) {
  return editToggle ? (
    <button
      type="button"
      aria-label={
        editToggle.editable ? "Switch to view mode" : "Switch to edit mode"
      }
      title={editToggle.editable ? "View" : "Edit"}
      onClick={editToggle.toggle}
      className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {editToggle.editable ? (
        <Eye className="size-3.5" />
      ) : (
        <Pencil className="size-3.5" />
      )}
    </button>
  ) : null;
}

export function ToolbarFileActions({
  isDownloading,
  previewUrl,
  canDownload,
  onDownload,
  onCopyLink,
  onClose,
}: {
  isDownloading: boolean;
  previewUrl: string | null;
  canDownload: boolean;
  onDownload: () => void;
  onCopyLink: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Download file"
        title="Download"
        disabled={!canDownload || isDownloading}
        onClick={onDownload}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isDownloading ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-3.5 shrink-0 animate-spin"
          />
        ) : (
          <Download aria-hidden="true" className="size-3.5 shrink-0" />
        )}
      </button>
      <button
        type="button"
        aria-label="Copy file link"
        title="Copy link"
        disabled={!previewUrl}
        onClick={onCopyLink}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Link2 aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        aria-label="Print file"
        title="Print"
        disabled={!previewUrl}
        onClick={() => window.print()}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Printer aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        aria-label="Close preview"
        title="Close preview"
        onClick={onClose}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <X aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </>
  );
}
