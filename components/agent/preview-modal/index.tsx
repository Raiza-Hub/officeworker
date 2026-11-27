"use client";

import { useEffect } from "react";
import { showPreviewUnsupportedToast } from "@/lib/preview-errors";
import { m, useReducedMotion } from "motion/react";
import { PreviewContent } from "./preview-content";
import { PreviewToolbar } from "./preview-toolbar";
import {
  usePreviewActions,
  usePreviewControlState,
  usePreviewDismiss,
  usePreviewEditorState,
  usePreviewUrlState,
} from "@/hooks/use-preview-modal-state";

type PreviewModalProps = {
  storageKey: string | null;
  filename: string;
  mediaType?: string;
  allowEdit?: boolean;
  onClose: () => void;
};

export function PreviewModal({
  storageKey,
  filename,
  mediaType,
  allowEdit,
  onClose,
}: PreviewModalProps) {
  const open = storageKey !== null;
  const editor = usePreviewEditorState();
  const controls = usePreviewControlState();
  const close = usePreviewDismiss(onClose, open, controls.reset);
  const url = usePreviewUrlState({ storageKey, filename, mediaType, close });
  const actions = usePreviewActions({
    kind: url.kind,
    allowEdit,
    storageKey,
    activeFilename: url.activeFilename,
    previewUrl: url.previewUrl,
    isContentLoading: url.isContentLoading,
    editor,
    controls,
  });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open || url.kind !== "unsupported") return;
    showPreviewUnsupportedToast(storageKey);
    close();
  }, [open, url.kind, close, storageKey]);

  if (open && url.kind === "unsupported") {
    return null;
  }

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={`${url.activeFilename} preview`}
      inert={!open}
      onClick={close}
      id="attachment-preview-root"
      initial={false}
      animate={open ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeInOut" }}
      className={`fixed inset-0 z-50 flex flex-col bg-white text-[#202124] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <PreviewToolbar
        filename={url.activeFilename}
        kind={url.kind}
        isContentLoading={url.isContentLoading}
        isDownloading={actions.isDownloading}
        previewUrl={url.previewUrl}
        canDownload={actions.canDownload}
        pdfZoomApi={editor.pdfZoomApi}
        pptxZoomApi={editor.pptxZoomApi}
        pptxView={editor.pptxView}
        pptxEditor={editor.pptxEditor}
        docxZoomApi={editor.docxZoomApi}
        csvZoom={controls.csvZoom}
        onCsvZoomChange={controls.setCsvZoom}
        imageZoom={controls.imageZoom}
        onImageZoomChange={controls.setImageZoom}
        editToggle={actions.editToggle}
        onDownload={() => void actions.handleDownload()}
        onCopyLink={() => void actions.handleCopyLink()}
        onClose={close}
      />
      <PreviewContent
        open={open}
        previewUrl={url.previewUrl}
        kind={url.kind}
        filename={url.activeFilename}
        isContentLoading={url.isContentLoading}
        docxEditable={allowEdit === true && controls.docxEditable}
        pptxEditable={allowEdit === true && controls.pptxEditable}
        xlsxEditable={allowEdit === true && controls.xlsxEditable}
        csvEditable={allowEdit === true && controls.csvEditable}
        csvZoom={controls.csvZoom}
        onCsvZoomChange={controls.setCsvZoom}
        imageZoom={controls.imageZoom}
        onPdfZoomApi={editor.setPdfZoomApi}
        onPptxZoomApi={editor.setPptxZoomApi}
        onDocxZoomApi={editor.setDocxZoomApi}
        onPptxEditorReady={editor.setPptxEditor}
        onDocxEditorReady={editor.setDocxEditor}
        onXlsxSaveApi={editor.setXlsxSaveApi}
        onCsvSaveApi={editor.setCsvSaveApi}
        onLoaded={url.markLoaded}
        onError={url.markPreviewError}
      />
    </m.div>
  );
}
