import { toast } from "sonner";

const unsupportedDescription =
  "This file format can't be displayed in the browser. Download it to view the contents.";

export function showPreviewUnsupportedToast(key: string | null | undefined) {
  toast.error("Preview unavailable", {
    id: `preview-unsupported-${key}`,
    description: unsupportedDescription,
  });
}

export function showPreviewErrorToast(
  key: string | null | undefined,
  message: string,
) {
  toast.error("Preview unavailable", {
    id: `preview-error-${key}`,
    description: message || "Could not display this file",
  });
}
