import type { PreviewKind } from "@/lib/file-types";

export type PreviewContentState =
  | { type: "hidden" }
  | { type: "loading" }
  | { type: "pdf"; url: string }
  | { type: "spreadsheet"; url: string; kind: "csv" | "sheet" }
  | { type: "pptx"; url: string }
  | { type: "docx"; url: string }
  | { type: "image"; url: string };

export function resolvePreviewContentState(
  open: boolean,
  previewUrl: string | null,
  kind: PreviewKind,
): PreviewContentState {
  if (!previewUrl) return open ? { type: "loading" } : { type: "hidden" };
  switch (kind) {
    case "pdf":
      return { type: "pdf", url: previewUrl };
    case "csv":
    case "sheet":
      return { type: "spreadsheet", url: previewUrl, kind };
    case "pptx":
      return { type: "pptx", url: previewUrl };
    case "docx":
      return { type: "docx", url: previewUrl };
    case "image":
      return { type: "image", url: previewUrl };
    default:
      return { type: "hidden" };
  }
}
