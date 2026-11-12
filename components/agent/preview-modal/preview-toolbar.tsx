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

export type EditToggleState = {
  editable: boolean;
  toggle: () => void;
};

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

const iconButtonClass =
  "inline-flex size-7 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/50 disabled:cursor-not-allowed disabled:opacity-40";

const zoomGroupClass = "mr-1 flex items-center gap-0.5 border-r border-[#eeeeef] pr-2";

const zoomValueClass =
  "min-w-[2.5rem] text-center text-[12px] tabular-nums text-[#5f6368]";

function stepCsvZoom(
  csvZoom: number,
  direction: 1 | -1,
  onChange: (zoom: number) => void,
) {
  const index = CSV_ZOOM_OPTIONS.indexOf(
    csvZoom as (typeof CSV_ZOOM_OPTIONS)[number],
  );
  const nextIndex = Math.min(
    CSV_ZOOM_OPTIONS.length - 1,
    Math.max(0, index + direction),
  );
  onChange(CSV_ZOOM_OPTIONS[nextIndex]);
}

function stepImageZoom(
  imageZoom: number,
  direction: 1 | -1,
  onChange: (zoom: number) => void,
) {
  onChange(
    Math.min(4, Math.max(0.25, Number((imageZoom + 0.25 * direction).toFixed(2)))),
  );
}

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
        <span className="truncate text-[13px] font-medium text-[#292a30]">
          {filename}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {kind === "pdf" && pdfZoomApi && !isContentLoading ? (
          <div className={zoomGroupClass}>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={pdfZoomApi.canZoomOut === false}
              onClick={() => pdfZoomApi.zoomOut?.()}
              className={iconButtonClass}
            >
              <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <span className={zoomValueClass}>
              {Math.round(pdfZoomApi.zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={pdfZoomApi.canZoomIn === false}
              onClick={() => pdfZoomApi.zoomIn?.()}
              className={iconButtonClass}
            >
              <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <button
              type="button"
              aria-label="Fit page"
              title="Fit page"
              onClick={() => pdfZoomApi.fit?.()}
              className={iconButtonClass}
            >
              <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          </div>
        ) : null}
        {kind === "pptx" &&
        pptxZoomApi &&
        !isContentLoading &&
        pptxView !== "slideSorter" ? (
          <div className={zoomGroupClass}>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={!pptxZoomApi.canZoomOut}
              onClick={() => pptxZoomApi.zoomOut()}
              className={iconButtonClass}
            >
              <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <span className={zoomValueClass}>
              {Math.round(pptxZoomApi.zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={!pptxZoomApi.canZoomIn}
              onClick={() => pptxZoomApi.zoomIn()}
              className={iconButtonClass}
            >
              <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <button
              type="button"
              aria-label="Fit slide"
              title="Fit slide"
              onClick={() => pptxZoomApi.fit()}
              className={iconButtonClass}
            >
              <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          </div>
        ) : null}
        {kind === "docx" && docxZoomApi && !isContentLoading ? (
          <div className={zoomGroupClass}>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={!docxZoomApi.canZoomOut}
              onClick={() => docxZoomApi.zoomOut()}
              className={iconButtonClass}
            >
              <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <span className={zoomValueClass}>
              {Math.round(docxZoomApi.zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={!docxZoomApi.canZoomIn}
              onClick={() => docxZoomApi.zoomIn()}
              className={iconButtonClass}
            >
              <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <button
              type="button"
              aria-label="Fit page width"
              title="Fit page width"
              onClick={() => docxZoomApi.auto()}
              className={iconButtonClass}
            >
              <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          </div>
        ) : null}
        {kind === "csv" && !isContentLoading ? (
          <div className={zoomGroupClass}>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={csvZoom <= CSV_ZOOM_OPTIONS[0]}
              onClick={() => stepCsvZoom(csvZoom, -1, onCsvZoomChange)}
              className={iconButtonClass}
            >
              <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <span className={zoomValueClass}>{Math.round(csvZoom * 100)}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={csvZoom >= CSV_ZOOM_OPTIONS[CSV_ZOOM_OPTIONS.length - 1]}
              onClick={() => stepCsvZoom(csvZoom, 1, onCsvZoomChange)}
              className={iconButtonClass}
            >
              <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          </div>
        ) : null}
        {kind === "image" && !isContentLoading ? (
          <div className={zoomGroupClass}>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={imageZoom <= 0.25}
              onClick={() => stepImageZoom(imageZoom, -1, onImageZoomChange)}
              className={iconButtonClass}
            >
              <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <span className={zoomValueClass}>
              {Math.round(imageZoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={imageZoom >= 4}
              onClick={() => stepImageZoom(imageZoom, 1, onImageZoomChange)}
              className={iconButtonClass}
            >
              <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
            <button
              type="button"
              aria-label="Fit image"
              title="Fit image"
              disabled={imageZoom === 1}
              onClick={() => onImageZoomChange(1)}
              className={iconButtonClass}
            >
              <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          </div>
        ) : null}
        {kind === "pptx" && pptxEditor && !isContentLoading ? (
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
            className={iconButtonClass}
          >
            {pptxView === "slideSorter" ? (
              <LayoutGrid aria-hidden="true" className="size-3.5 shrink-0" />
            ) : (
              <Presentation aria-hidden="true" className="size-3.5 shrink-0" />
            )}
          </button>
        ) : null}
        {editToggle ? (
          <button
            type="button"
            aria-label={
              editToggle.editable ? "Switch to view mode" : "Switch to edit mode"
            }
            title={editToggle.editable ? "View" : "Edit"}
            onClick={editToggle.toggle}
            className={iconButtonClass}
          >
            {editToggle.editable ? (
              <Eye className="size-3.5" />
            ) : (
              <Pencil className="size-3.5" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Download file"
          title="Download"
          disabled={!canDownload || isDownloading}
          onClick={onDownload}
          className={iconButtonClass}
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
          className={iconButtonClass}
        >
          <Link2 aria-hidden="true" className="size-3.5 shrink-0" />
        </button>
        <button
          type="button"
          aria-label="Print file"
          title="Print"
          disabled={!previewUrl}
          onClick={() => window.print()}
          className={iconButtonClass}
        >
          <Printer aria-hidden="true" className="size-3.5 shrink-0" />
        </button>
        <button
          type="button"
          aria-label="Close preview"
          title="Close preview"
          onClick={onClose}
          className={iconButtonClass}
        >
          <X aria-hidden="true" className="size-3.5 shrink-0" />
        </button>
      </div>
    </header>
  );
}
