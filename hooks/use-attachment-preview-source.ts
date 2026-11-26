"use client";

import { useEffect, useState } from "react";
import {
  fetchPreviewUrl,
  peekCachedPreviewUrl,
} from "@/components/agent/preview-url-cache";

export type AttachmentThumbnailData = {
  key?: string;
  name: string;
  mediaType: string;
};

export function useAttachmentPreviewSource(attachment: AttachmentThumbnailData) {
  const [previewSource, setPreviewSource] = useState<{
    key: string;
    url: string;
  } | null>(() => {
    const key = attachment.key;
    if (!key) return null;
    const cached = peekCachedPreviewUrl(key);
    return cached ? { key, url: cached.url } : null;
  });
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const fileUrl =
    attachment.key && previewSource?.key === attachment.key
      ? previewSource.url
      : null;
  const sourceError = Boolean(
    attachment.key && failedSourceKey === attachment.key,
  );

  useEffect(() => {
    const key = attachment.key;
    if (!key) return;
    if (previewSource?.key === key) return;
    let cancelled = false;
    void fetchPreviewUrl(key)
      .then(({ url }) => {
        if (!cancelled) setPreviewSource({ key, url });
      })
      .catch(() => {
        if (!cancelled) setFailedSourceKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.key, previewSource?.key]);

  return { fileUrl, sourceError };
}
