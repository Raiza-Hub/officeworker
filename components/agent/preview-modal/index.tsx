"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { m, useReducedMotion } from "motion/react";
import { fetchPreviewUrl, peekCachedPreviewUrl } from "@/components/agent/preview-url-cache";
import type { PDFViewerZoomApi } from "@/components/extend/pdf-viewer";
import type { PptxViewerZoomApi } from "@/components/agent/pptx-preview";
import type { DocxViewerZoomApi } from "@/components/agent/docx-preview";
import type { Editor as DocxEditorInstance } from "@docx-editor.dev/react";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import type { XlsxViewerSaveApi } from "@/components/agent/spreadsheet-preview";
import type { CsvViewerSaveApi } from "@/components/extend/csv-viewer";
import { getPreviewKind, type PreviewKind } from "@/lib/file-types";
import { saveCsv, saveDocx, savePptx, saveRemote, saveXlsx } from "./save-handlers";
import { PreviewContent } from "./preview-content";
import { PreviewToolbar, type EditToggleState } from "./preview-toolbar";

type PreviewModalProps = {
  storageKey: string | null;
  filename: string;
  mediaType?: string;
  onClose: () => void;
};

export function PreviewModal({
  storageKey,
  filename,
  mediaType,
  onClose,
}: PreviewModalProps) {
  const open = storageKey !== null;
  const [urlOwner, setUrlOwner] = useState<{
    key: string;
    url: string;
    filename: string;
    mediaType?: string;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(true);
  const [pdfZoomApi, setPdfZoomApi] = useState<PDFViewerZoomApi | null>(null);
  const [pptxZoomApi, setPptxZoomApi] = useState<PptxViewerZoomApi | null>(null);
  const [pptxEditable, setPptxEditable] = useState(false);
  const [pptxEditor, setPptxEditor] = useState<PptxEditorInstance | null>(null);
  const [pptxView, setPptxView] = useState<"normal" | "slideSorter">("normal");
  const [docxZoomApi, setDocxZoomApi] = useState<DocxViewerZoomApi | null>(null);
  const [docxEditable, setDocxEditable] = useState(false);
  const [docxEditor, setDocxEditor] = useState<DocxEditorInstance | null>(null);
  const [xlsxEditable, setXlsxEditable] = useState(false);
  const [xlsxSaveApi, setXlsxSaveApi] = useState<XlsxViewerSaveApi | null>(null);
  const [csvEditable, setCsvEditable] = useState(false);
  const [csvSaveApi, setCsvSaveApi] = useState<CsvViewerSaveApi | null>(null);
  const [csvZoom, setCsvZoom] = useState(1);
  const [imageZoom, setImageZoom] = useState(1);

  const closeRef = useRef(onClose);
  const prevOpenRef = useRef(open);
  const activeFilename = open ? filename : (urlOwner?.filename ?? filename);
  const activeMediaType = open ? mediaType : (urlOwner?.mediaType ?? mediaType);
  const kind = getPreviewKind(activeFilename, activeMediaType);
  const previewUrl = open
    ? urlOwner?.key === storageKey
      ? urlOwner.url
      : null
    : (urlOwner?.url ?? null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!pptxEditor) return;
    const syncView = () => {
      setPptxView(
        pptxEditor.snapshot().presentationView === "slideSorter"
          ? "slideSorter"
          : "normal",
      );
    };
    syncView();
    return pptxEditor.subscribe(syncView);
  }, [pptxEditor]);

  const close = useCallback(() => closeRef.current(), []);

  useEffect(() => {
    if (!open || kind !== "unsupported") return;
    toast.error("Preview unavailable", {
      id: `preview-unsupported-${storageKey}`,
      description:
        "This file format can't be displayed in the browser. Download it to view the contents.",
    });
    close();
  }, [open, kind, close, storageKey]);

  useEffect(() => {
    if (!storageKey || kind === "unsupported") return;
    if (urlOwner?.key === storageKey) return;
    let cancelled = false;
    const cached = peekCachedPreviewUrl(storageKey);
    if (cached) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setIsContentLoading(true);
        setUrlOwner({ key: storageKey, url: cached.url, filename, mediaType });
      });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const data = await fetchPreviewUrl(storageKey);
        if (!cancelled) {
          setIsContentLoading(true);
          setUrlOwner({ key: storageKey, url: data.url, filename, mediaType });
        }
      } catch (error) {
        if (cancelled) return;
        setIsContentLoading(false);
        toast.error("Preview unavailable", {
          id: `preview-error-${storageKey}`,
          description:
            error instanceof Error ? error.message : "Could not load this file",
        });
        close();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey, kind, close, urlOwner?.key, filename, mediaType]);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      setDocxEditable(false);
      setPptxEditable(false);
      setCsvEditable(false);
      setXlsxEditable(false);
      setCsvZoom(1);
      setImageZoom(1);
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  async function runDownload(save: () => void | Promise<void>) {
    setIsDownloading(true);
    try {
      await save();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownload() {
    if (kind === "docx" && docxEditable && docxEditor) {
      await runDownload(() => saveDocx(docxEditor, activeFilename));
      return;
    }
    if (kind === "pptx" && pptxEditable && pptxEditor) {
      await runDownload(() => savePptx(pptxEditor, activeFilename));
      return;
    }
    if (kind === "csv" && csvEditable && csvSaveApi) {
      await runDownload(() => saveCsv(csvSaveApi, activeFilename));
      return;
    }
    if (kind === "sheet" && xlsxEditable && xlsxSaveApi) {
      await runDownload(() => saveXlsx(xlsxSaveApi, activeFilename));
      return;
    }
    if (!storageKey) return;
    await runDownload(() => saveRemote(storageKey, activeFilename));
  }

  async function handleCopyLink() {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success("Temporary file link copied", {
        description: "This private link expires in one hour.",
      });
    } catch {
      toast.error("Could not copy the file link");
    }
  }

  const markPreviewError = useCallback(
    (error: Error) => {
      setIsContentLoading(false);
      toast.error("Preview unavailable", {
        id: `preview-error-${storageKey}`,
        description: error.message || "Could not display this file",
      });
      close();
    },
    [close, storageKey],
  );

  const markLoaded = useCallback(() => setIsContentLoading(false), []);

  const editToggle = buildEditToggle({
    kind,
    csvSaveApi,
    xlsxSaveApi,
    isContentLoading,
    csvEditable,
    xlsxEditable,
    docxEditable,
    pptxEditable,
    onToggleCsv: () => setCsvEditable((v) => !v),
    onToggleXlsx: () => setXlsxEditable((v) => !v),
    onToggleDocx: () => setDocxEditable((v) => !v),
    onTogglePptx: () => setPptxEditable((v) => !v),
  });

  const canDownload = Boolean(
    previewUrl ||
      (kind === "docx" && docxEditable && docxEditor) ||
      (kind === "pptx" && pptxEditable && pptxEditor) ||
      (kind === "sheet" && xlsxEditable && xlsxSaveApi) ||
      (kind === "csv" && csvEditable && csvSaveApi),
  );

  const shouldReduceMotion = useReducedMotion();

  if (open && kind === "unsupported") {
    return null;
  }

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={`${activeFilename} preview`}
      inert={!open}
      onClick={close}
      id="attachment-preview-root"
      initial={false}
      animate={open ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeInOut" }}
      className={`fixed inset-0 z-50 flex flex-col bg-white text-[#202124] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <PreviewToolbar
        filename={activeFilename}
        kind={kind}
        isContentLoading={isContentLoading}
        isDownloading={isDownloading}
        previewUrl={previewUrl}
        canDownload={canDownload}
        pdfZoomApi={pdfZoomApi}
        pptxZoomApi={pptxZoomApi}
        pptxView={pptxView}
        pptxEditor={pptxEditor}
        docxZoomApi={docxZoomApi}
        csvZoom={csvZoom}
        onCsvZoomChange={setCsvZoom}
        imageZoom={imageZoom}
        onImageZoomChange={setImageZoom}
        editToggle={editToggle}
        onDownload={() => void handleDownload()}
        onCopyLink={() => void handleCopyLink()}
        onClose={close}
      />
      <PreviewContent
        open={open}
        previewUrl={previewUrl}
        kind={kind}
        filename={activeFilename}
        isContentLoading={isContentLoading}
        docxEditable={docxEditable}
        pptxEditable={pptxEditable}
        xlsxEditable={xlsxEditable}
        csvEditable={csvEditable}
        csvZoom={csvZoom}
        onCsvZoomChange={setCsvZoom}
        imageZoom={imageZoom}
        onPdfZoomApi={setPdfZoomApi}
        onPptxZoomApi={setPptxZoomApi}
        onDocxZoomApi={setDocxZoomApi}
        onPptxEditorReady={setPptxEditor}
        onDocxEditorReady={setDocxEditor}
        onXlsxSaveApi={setXlsxSaveApi}
        onCsvSaveApi={setCsvSaveApi}
        onLoaded={markLoaded}
        onError={markPreviewError}
      />
    </m.div>
  );
}

function buildEditToggle(input: {
  kind: PreviewKind;
  csvSaveApi: CsvViewerSaveApi | null;
  xlsxSaveApi: XlsxViewerSaveApi | null;
  isContentLoading: boolean;
  csvEditable: boolean;
  xlsxEditable: boolean;
  docxEditable: boolean;
  pptxEditable: boolean;
  onToggleCsv: () => void;
  onToggleXlsx: () => void;
  onToggleDocx: () => void;
  onTogglePptx: () => void;
}): EditToggleState | null {
  switch (input.kind) {
    case "docx":
      return {
        editable: input.docxEditable,
        toggle: input.onToggleDocx,
      };
    case "pptx":
      return {
        editable: input.pptxEditable,
        toggle: input.onTogglePptx,
      };
    case "csv":
      return input.csvSaveApi && !input.isContentLoading
        ? { editable: input.csvEditable, toggle: input.onToggleCsv }
        : null;
    case "sheet":
      return input.xlsxSaveApi && !input.isContentLoading
        ? { editable: input.xlsxEditable, toggle: input.onToggleXlsx }
        : null;
    default:
      return null;
  }
}
