export type PreviewKind =
  | "image"
  | "pdf"
  | "csv"
  | "sheet"
  | "pptx"
  | "docx"
  | "unsupported";

export function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function getPreviewKind(filename: string, mediaType = ""): PreviewKind {
  const extension = getFileExtension(filename);
  if (
    mediaType.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff"].includes(
      extension,
    )
  ) {
    return "image";
  }
  if (mediaType === "application/pdf" || extension === "pdf") return "pdf";
  if (extension === "csv" || mediaType.includes("csv")) return "csv";
  if (extension === "xlsx") return "sheet";
  if (extension === "pptx") return "pptx";
  if (
    extension === "docx" ||
    mediaType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "unsupported";
}

export function isPreviewSupported(filename: string, mediaType = "") {
  return getPreviewKind(filename, mediaType) !== "unsupported";
}
