const MAX_REVEALED_PREVIEW_IMAGE_URLS = 256;
const revealedPreviewImageUrls = new Map<string, number>();

export function hasRevealedPreviewImageUrl(url: string) {
  return revealedPreviewImageUrls.has(url);
}

export function markRevealedPreviewImageUrl(url: string) {
  const count = revealedPreviewImageUrls.get(url) ?? 0;
  revealedPreviewImageUrls.delete(url);
  revealedPreviewImageUrls.set(url, count + 1);
  while (revealedPreviewImageUrls.size > MAX_REVEALED_PREVIEW_IMAGE_URLS) {
    const oldestUrl = revealedPreviewImageUrls.keys().next().value;
    if (oldestUrl === undefined) return;
    revealedPreviewImageUrls.delete(oldestUrl);
  }
}

export function releaseRevealedPreviewImageUrl(url: string) {
  const count = revealedPreviewImageUrls.get(url);
  if (count === undefined) return;
  if (count <= 1) {
    revealedPreviewImageUrls.delete(url);
    return;
  }
  revealedPreviewImageUrls.set(url, count - 1);
}

export const clearRevealedPreviewImageUrl = releaseRevealedPreviewImageUrl;
