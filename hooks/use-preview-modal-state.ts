import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  fetchPreviewUrl,
  peekCachedPreviewUrl,
} from "@/components/agent/preview-url-cache";
import type { PDFViewerZoomApi } from "@/components/extend/pdf-viewer";
import type { PptxViewerZoomApi } from "@/components/agent/pptx-preview";
import type { DocxViewerZoomApi } from "@/components/agent/docx-preview";
import type { Editor as DocxEditorInstance } from "@docx-editor.dev/react";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import type { XlsxViewerSaveApi } from "@/lib/file-preview-types";
import type { CsvViewerSaveApi } from "@/components/extend/csv-viewer";
import { getPreviewKind } from "@/lib/file-types";
import { showPreviewErrorToast } from "@/lib/preview-errors";
import {
  buildEditToggle,
  canDownloadPreview,
  resolveDownloadSave,
  type DownloadSaveInput,
  type PreviewActionsInput,
} from "@/components/agent/preview-modal/preview-actions-utils";
import type { EditToggleState } from "@/components/agent/preview-modal/preview-toolbar-types";

type PreviewUrlOwner = {
  key: string;
  url: string;
  filename: string;
  mediaType?: string;
};

export function usePreviewEditorState() {
  const [pdfZoomApi, setPdfZoomApi] = useState<PDFViewerZoomApi | null>(null);
  const [pptxZoomApi, setPptxZoomApi] = useState<PptxViewerZoomApi | null>(
    null,
  );
  const [pptxEditor, setPptxEditor] = useState<PptxEditorInstance | null>(null);
  const [pptxView, setPptxView] = useState<"normal" | "slideSorter">("normal");
  const [docxZoomApi, setDocxZoomApi] = useState<DocxViewerZoomApi | null>(
    null,
  );
  const [docxEditor, setDocxEditor] = useState<DocxEditorInstance | null>(null);
  const [xlsxSaveApi, setXlsxSaveApi] = useState<XlsxViewerSaveApi | null>(
    null,
  );
  const [csvSaveApi, setCsvSaveApi] = useState<CsvViewerSaveApi | null>(null);

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

  return {
    pdfZoomApi,
    pptxZoomApi,
    pptxEditor,
    pptxView,
    docxZoomApi,
    docxEditor,
    xlsxSaveApi,
    csvSaveApi,
    setPdfZoomApi,
    setPptxZoomApi,
    setPptxEditor,
    setDocxZoomApi,
    setDocxEditor,
    setXlsxSaveApi,
    setCsvSaveApi,
  };
}

export function usePreviewControlState() {
  const [docxEditable, setDocxEditable] = useState(false);
  const [pptxEditable, setPptxEditable] = useState(false);
  const [csvEditable, setCsvEditable] = useState(false);
  const [xlsxEditable, setXlsxEditable] = useState(false);
  const [csvZoom, setCsvZoom] = useState(1);
  const [imageZoom, setImageZoom] = useState(1);

  const reset = useCallback(() => {
    setDocxEditable(false);
    setPptxEditable(false);
    setCsvEditable(false);
    setXlsxEditable(false);
    setCsvZoom(1);
    setImageZoom(1);
  }, []);

  const toggleCsv = useCallback(() => setCsvEditable((value) => !value), []);
  const toggleXlsx = useCallback(() => setXlsxEditable((value) => !value), []);
  const toggleDocx = useCallback(() => setDocxEditable((value) => !value), []);
  const togglePptx = useCallback(() => setPptxEditable((value) => !value), []);

  return {
    docxEditable,
    pptxEditable,
    csvEditable,
    xlsxEditable,
    csvZoom,
    imageZoom,
    setCsvZoom,
    setImageZoom,
    toggleCsv,
    toggleXlsx,
    toggleDocx,
    togglePptx,
    reset,
  };
}

export function usePreviewDismiss(
  onClose: () => void,
  open: boolean,
  reset: () => void,
) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const close = useCallback(() => {
    reset();
    closeRef.current();
  }, [reset]);

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

  return close;
}

export function usePreviewUrlState({
  storageKey,
  filename,
  mediaType,
  close,
}: {
  storageKey: string | null;
  filename: string;
  mediaType?: string;
  close: () => void;
}) {
  const [urlOwner, setUrlOwner] = useState<PreviewUrlOwner | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(true);

  const open = storageKey !== null;
  const activeFilename = open ? filename : (urlOwner?.filename ?? filename);
  const activeMediaType = open ? mediaType : (urlOwner?.mediaType ?? mediaType);
  const kind = getPreviewKind(activeFilename, activeMediaType);
  const previewUrl = open
    ? urlOwner?.key === storageKey
      ? urlOwner.url
      : null
    : (urlOwner?.url ?? null);

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
        showPreviewErrorToast(
          storageKey,
          error instanceof Error ? error.message : "Could not load this file",
        );
        close();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey, kind, close, urlOwner?.key, filename, mediaType]);

  const markPreviewError = useCallback(
    (error: Error) => {
      setIsContentLoading(false);
      showPreviewErrorToast(storageKey, error.message);
      close();
    },
    [close, storageKey],
  );

  const markLoaded = useCallback(() => setIsContentLoading(false), []);

  return {
    kind,
    activeFilename,
    previewUrl,
    isContentLoading,
    markLoaded,
    markPreviewError,
  };
}

export function usePreviewActions({
  kind,
  allowEdit,
  storageKey,
  activeFilename,
  previewUrl,
  isContentLoading,
  editor,
  controls,
}: PreviewActionsInput) {
  const [isDownloading, setIsDownloading] = useState(false);

  const runDownload = useCallback(async (save: () => void | Promise<void>) => {
    setIsDownloading(true);
    try {
      await save();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const downloadInput = useMemo<DownloadSaveInput>(
    () => ({
      kind,
      storageKey,
      activeFilename,
      docxEditable: controls.docxEditable,
      docxEditor: editor.docxEditor,
      pptxEditable: controls.pptxEditable,
      pptxEditor: editor.pptxEditor,
      csvEditable: controls.csvEditable,
      csvSaveApi: editor.csvSaveApi,
      xlsxEditable: controls.xlsxEditable,
      xlsxSaveApi: editor.xlsxSaveApi,
    }),
    [
      kind,
      storageKey,
      activeFilename,
      controls.docxEditable,
      editor.docxEditor,
      controls.pptxEditable,
      editor.pptxEditor,
      controls.csvEditable,
      editor.csvSaveApi,
      controls.xlsxEditable,
      editor.xlsxSaveApi,
    ],
  );

  const handleDownload = useCallback(async () => {
    const save = resolveDownloadSave(downloadInput);
    if (!save) return;
    await runDownload(save);
  }, [downloadInput, runDownload]);

  const handleCopyLink = useCallback(async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success("Temporary file link copied", {
        description: "This private link expires in one hour.",
      });
    } catch {
      toast.error("Could not copy the file link");
    }
  }, [previewUrl]);

  const editToggle: EditToggleState | null = buildEditToggle({
    kind,
    allowEdit,
    csvSaveApi: editor.csvSaveApi,
    xlsxSaveApi: editor.xlsxSaveApi,
    isContentLoading,
    csvEditable: controls.csvEditable,
    xlsxEditable: controls.xlsxEditable,
    docxEditable: controls.docxEditable,
    pptxEditable: controls.pptxEditable,
    onToggleCsv: controls.toggleCsv,
    onToggleXlsx: controls.toggleXlsx,
    onToggleDocx: controls.toggleDocx,
    onTogglePptx: controls.togglePptx,
  });

  const canDownload = canDownloadPreview({ ...downloadInput, previewUrl });

  return {
    isDownloading,
    editToggle,
    canDownload,
    handleDownload,
    handleCopyLink,
  };
}
