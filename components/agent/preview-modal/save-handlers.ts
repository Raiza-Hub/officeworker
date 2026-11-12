import type { Editor as DocxEditorInstance } from "@docx-editor.dev/react";
import type { PptxEditorInstance } from "@pptx-editor.dev/react";
import type { XlsxViewerSaveApi } from "@/components/agent/spreadsheet-preview";
import type { CsvViewerSaveApi } from "@/components/extend/csv-viewer";
import { fetchDownloadUrl } from "@/components/agent/preview-url-cache";
import { downloadBlob, downloadFileUrl } from "@/lib/download";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function saveDocx(
  editor: DocxEditorInstance,
  filename: string,
) {
  const bytes = await editor.save();
  if (!bytes) throw new Error("Nothing to download");
  downloadBlob(bytes, filename, DOCX_MIME);
}

export async function savePptx(
  editor: PptxEditorInstance,
  filename: string,
) {
  const bytes = editor.save();
  if (!bytes) throw new Error("The presentation cannot be saved.");
  downloadBlob(bytes, filename, PPTX_MIME);
}

export function saveCsv(api: CsvViewerSaveApi, filename: string) {
  const name = /\.(csv|tsv)$/i.test(filename)
    ? filename
    : `${filename}.csv`;
  downloadBlob(api.getText(), name, "text/csv;charset=utf-8");
}

export function saveXlsx(api: XlsxViewerSaveApi, filename: string) {
  const bytes = api.getBytes();
  if (!bytes) throw new Error("The spreadsheet cannot be saved.");
  downloadBlob(bytes as BlobPart, filename, XLSX_MIME);
}

export async function saveRemote(storageKey: string, filename: string) {
  const data = await fetchDownloadUrl(storageKey);
  downloadFileUrl(data.url, data.filename ?? filename);
}
