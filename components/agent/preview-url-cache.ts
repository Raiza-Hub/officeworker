export type PreviewUrlResponse = {
  url: string;
  filename: string;
  expiresAt: number;
};

const EXPIRY_MARGIN_MS = 60_000;
const cache = new Map<string, PreviewUrlResponse>();
const inflight = new Map<string, Promise<PreviewUrlResponse>>();

function cacheKey(storageKey: string, download: boolean) {
  return `${download ? "dl" : "view"}:${storageKey}`;
}

async function requestPreviewUrl(
  key: string,
  download: boolean,
): Promise<PreviewUrlResponse> {
  const response = await fetch("/api/files/preview-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, download }),
  });

  let data: { url?: string; filename?: string; expiresAt?: number; error?: string } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    data = {};
  }

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Could not prepare the file");
  }

  return {
    url: data.url,
    filename: data.filename ?? key.split("/").pop() ?? "file",
    expiresAt:
      typeof data.expiresAt === "number"
        ? data.expiresAt
        : Date.now() + 55 * 60_000,
  };
}

async function getPreviewUrl(
  key: string,
  download: boolean,
): Promise<PreviewUrlResponse> {
  const entryKey = cacheKey(key, download);
  const cached = cache.get(entryKey);
  if (cached && cached.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
    return cached;
  }
  if (cached) {
    cache.delete(entryKey);
  }

  const pending = inflight.get(entryKey);
  if (pending) return pending;

  const request = requestPreviewUrl(key, download)
    .then((result) => {
      cache.set(entryKey, result);
      return result;
    })
    .finally(() => {
      inflight.delete(entryKey);
    });

  inflight.set(entryKey, request);
  return request;
}

export async function fetchPreviewUrl(key: string): Promise<PreviewUrlResponse> {
  return getPreviewUrl(key, false);
}

export async function fetchDownloadUrl(
  key: string,
): Promise<PreviewUrlResponse> {
  return getPreviewUrl(key, true);
}

export function peekCachedPreviewUrl(
  key: string,
  download = false,
): PreviewUrlResponse | null {
  const entryKey = cacheKey(key, download);
  const cached = cache.get(entryKey);
  if (cached && cached.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
    return cached;
  }
  if (cached) {
    cache.delete(entryKey);
  }
  return null;
}
