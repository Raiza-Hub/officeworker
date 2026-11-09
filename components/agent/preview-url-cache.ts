type PreviewUrlResponse = { url: string; filename?: string };

const PREVIEW_URL_CACHE_MS = 50 * 60 * 1000;
const previewUrls = new Map<
  string,
  { value: PreviewUrlResponse; expiresAt: number }
>();
const pendingRequests = new Map<string, Promise<PreviewUrlResponse>>();

export function getPreviewUrl(key: string): Promise<PreviewUrlResponse> {
  const cached = previewUrls.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const request = fetch("/api/files/preview-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  })
    .then(async (response) => {
      const data = (await response.json()) as {
        url?: string;
        filename?: string;
        error?: string;
      };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not prepare the preview");
      }
      const value = { url: data.url, filename: data.filename };
      previewUrls.set(key, { value, expiresAt: Date.now() + PREVIEW_URL_CACHE_MS });
      return value;
    })
    .finally(() => pendingRequests.delete(key));

  pendingRequests.set(key, request);
  return request;
}

export function prefetchPreviewUrl(key: string): void {
  void getPreviewUrl(key).catch(() => {});
}

export function prefetchAttachmentPreview(
  attachment: { key: string; name: string; mediaType: string },
): void {
  prefetchPreviewUrl(attachment.key);
  if (
    attachment.mediaType === "application/pdf" ||
    attachment.name.toLowerCase().endsWith(".pdf")
  ) {
    void import("@/components/agent/pdf-preview");
  }
}
