"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import { fetchPreviewUrl, peekCachedPreviewUrl } from "@/components/agent/preview-url-cache";
import { toast } from "sonner";
import { isPreviewSupported } from "@/lib/file-types";

const AttachmentThumbnailPreview = dynamic(
  () =>
    import("@/components/agent/attachment-thumbnail-preview").then(
      (module) => module.AttachmentThumbnailPreview,
    ),
  {
    ssr: false,
    loading: () => (
      <FileThumbnail
        file={{ name: "Loading preview", type: "application/octet-stream" }}
        previewAspectRatio={1}
        isLoading
        className="w-full rounded-md border-0 bg-transparent shadow-none"
      />
    ),
  },
);

export type AttachmentThumbnailData = {
  key?: string;
  name: string;
  mediaType: string;
};

export function AttachmentThumbnail({
  attachment,
  onPreview,
  onRemove,
  isUploading = false,
  inverse = false,
}: {
  attachment: AttachmentThumbnailData;
  onPreview?: () => void;
  onRemove?: () => void;
  isUploading?: boolean;
  inverse?: boolean;
}) {
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
  const previewSupported = isPreviewSupported(attachment.name, attachment.mediaType);
  const canPreview = Boolean(onPreview) && previewSupported;
  const canShowPreviewError = Boolean(onPreview) && !previewSupported;

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

  const preview = (
    <>
      <AttachmentThumbnailPreview
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading}
        sourceError={sourceError}
      />
      <span
        title={attachment.name}
        className={`mt-1 block w-full truncate text-left text-[11px] leading-4 ${inverse ? "text-white" : "text-[#45474e]"}`}
      >
        {attachment.name}
      </span>
    </>
  );

  return (
    <div className="group/attachment relative w-[112px] shrink-0">
      {canPreview ? (
        <button
          type="button"
          aria-label={`Preview ${attachment.name}`}
          title={attachment.name}
          aria-busy={isUploading || Boolean(attachment.key && !fileUrl && !sourceError)}
          onClick={onPreview}
          className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/50"
        >
          {preview}
        </button>
      ) : canShowPreviewError ? (
        <button
          type="button"
          aria-label={`Preview ${attachment.name}`}
          title={attachment.name}
          onClick={() =>
            toast.error("Preview unavailable", {
              id: `preview-unsupported-${attachment.key ?? attachment.name}`,
              description:
                "This file format can't be displayed in the browser. Download it to view the contents.",
            })
          }
          className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/50"
        >
          {preview}
        </button>
      ) : (
        <div
          aria-label={`Uploading ${attachment.name}`}
          aria-busy={isUploading || Boolean(attachment.key && !fileUrl && !sourceError)}
          className="w-full"
        >
          {preview}
        </div>
      )}
      {isUploading ? (
        <span
          role="status"
          aria-label={`Uploading ${attachment.name}`}
          className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-white/90 text-[#626bd9] shadow-sm"
        >
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        </span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${attachment.name}`}
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border border-white bg-[#45474e] text-white shadow-sm transition-opacity hover:bg-[#303137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/50 sm:opacity-0 sm:group-hover/attachment:opacity-100 sm:focus-visible:opacity-100"
        >
          <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}
