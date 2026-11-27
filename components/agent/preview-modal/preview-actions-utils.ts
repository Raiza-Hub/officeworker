import type { Editor as DocxEditorInstance } from "@docx-editor.dev/react";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import type {
  usePreviewControlState,
  usePreviewEditorState,
} from "@/hooks/use-preview-modal-state";
import type { CsvViewerSaveApi } from "@/components/extend/csv-viewer";
import type { XlsxViewerSaveApi } from "@/lib/file-preview-types";
import type { PreviewKind } from "@/lib/file-types";
import {
  saveCsv,
  saveDocx,
  savePptx,
  saveRemote,
  saveXlsx,
} from "./save-handlers";
import type { EditToggleState } from "./preview-toolbar-types";

export type DownloadSaveInput = {
  kind: PreviewKind;
  storageKey: string | null;
  activeFilename: string;
  docxEditable: boolean;
  docxEditor: DocxEditorInstance | null;
  pptxEditable: boolean;
  pptxEditor: PptxEditorInstance | null;
  csvEditable: boolean;
  csvSaveApi: CsvViewerSaveApi | null;
  xlsxEditable: boolean;
  xlsxSaveApi: XlsxViewerSaveApi | null;
};

export function resolveDownloadSave(input: DownloadSaveInput) {
  const { docxEditor, pptxEditor, csvSaveApi, xlsxSaveApi } = input;
  if (input.kind === "docx" && input.docxEditable && docxEditor) {
    return () => saveDocx(docxEditor, input.activeFilename);
  }
  if (input.kind === "pptx" && input.pptxEditable && pptxEditor) {
    return () => savePptx(pptxEditor, input.activeFilename);
  }
  if (input.kind === "csv" && input.csvEditable && csvSaveApi) {
    return () => saveCsv(csvSaveApi, input.activeFilename);
  }
  if (input.kind === "sheet" && input.xlsxEditable && xlsxSaveApi) {
    return () => saveXlsx(xlsxSaveApi, input.activeFilename);
  }
  const storageKey = input.storageKey;
  if (!storageKey) return null;
  return () => saveRemote(storageKey, input.activeFilename);
}

export function canDownloadPreview(
  input: DownloadSaveInput & { previewUrl: string | null },
) {
  return Boolean(
    input.previewUrl ||
    (input.kind === "docx" && input.docxEditable && input.docxEditor) ||
    (input.kind === "pptx" && input.pptxEditable && input.pptxEditor) ||
    (input.kind === "sheet" && input.xlsxEditable && input.xlsxSaveApi) ||
    (input.kind === "csv" && input.csvEditable && input.csvSaveApi),
  );
}

export function buildEditToggle(input: {
  kind: PreviewKind;
  allowEdit?: boolean;
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
  if (input.allowEdit === false) return null;
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

export type PreviewActionsInput = {
  kind: PreviewKind;
  allowEdit?: boolean;
  storageKey: string | null;
  activeFilename: string;
  previewUrl: string | null;
  isContentLoading: boolean;
  editor: ReturnType<typeof usePreviewEditorState>;
  controls: ReturnType<typeof usePreviewControlState>;
};
