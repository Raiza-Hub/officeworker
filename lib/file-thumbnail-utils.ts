import type { ReactNode } from "react";
import { hasRevealedPreviewImageUrl } from "./file-thumbnail-store";

type ThumbnailDisplayStateInput = {
  isLoading: boolean;
  hasError: boolean;
  previewImageUrl: string | null | undefined;
  previewContent: ReactNode;
  loadedPreviewImageUrl: string | null;
  failedPreviewImageUrl: string | null;
};

export function getThumbnailDisplayState({
  isLoading,
  hasError,
  previewImageUrl,
  previewContent,
  loadedPreviewImageUrl,
  failedPreviewImageUrl,
}: ThumbnailDisplayStateInput) {
  const imageFailed = Boolean(
    previewImageUrl && failedPreviewImageUrl === previewImageUrl,
  );
  const isImageLoading = Boolean(
    previewImageUrl &&
      loadedPreviewImageUrl !== previewImageUrl &&
      !imageFailed &&
      !hasRevealedPreviewImageUrl(previewImageUrl),
  );
  const showLoading = isLoading || isImageLoading;
  const hasPreviewContent = Boolean(previewContent);
  const showFallback =
    !showLoading &&
    (hasError || imageFailed || (!previewImageUrl && !hasPreviewContent));
  return { showLoading, showFallback };
}
