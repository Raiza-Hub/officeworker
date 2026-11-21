"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import { fetchPreviewUrl, peekCachedPreviewUrl } from "@/components/agent/preview-url-cache";
import { SquishProgressBar } from "@/components/ui/squish-progress-bar";
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
  className = "w-28",
  nameLines = 1,
  progress = null,
  footer,
  onCancel,
}: {
  attachment: AttachmentThumbnailData;
  onPreview?: () => void;
  onRemove?: () => void;
  isUploading?: boolean;
  inverse?: boolean;
  className?: string;
  nameLines?: 1 | 2;
  progress?: number | "indeterminate" | null;
  footer?: React.ReactNode;
  onCancel?: () => void;
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

  const progressBar =
    progress === null ? null : progress === "indeterminate" ? (
      <div
        key="indeterminate"
        role="progressbar"
        aria-label={`Uploading ${attachment.name}`}
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border-muted"
      >
        <div className="h-full w-full animate-pulse rounded-full bg-primary/60" />
      </div>
    ) : (
      <SquishProgressBar
        key="determinate"
        progress={progress}
        ariaLabel={`Uploading ${attachment.name}`}
      />
    );

  const preview = (
    <>
      <AttachmentThumbnailPreview
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading || progress !== null}
        sourceError={sourceError}
      />
      <span
        title={attachment.name}
        className={`mt-1 block w-full text-left text-[11px] leading-4 ${inverse ? "text-white" : "text-text-secondary"} ${nameLines === 2 ? "line-clamp-2 break-words" : "truncate"}`}
      >
        {attachment.name}
      </span>
      {progressBar}
      {footer ? <div className="mt-1.5">{footer}</div> : null}
    </>
  );

  return (
    <div className={`group/attachment relative shrink-0 ${className}`}>
      {canPreview ? (
        <button
          type="button"
          aria-label={`Preview ${attachment.name}`}
          title={attachment.name}
          aria-busy={isUploading || Boolean(attachment.key && !fileUrl && !sourceError)}
          onClick={onPreview}
          className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
          className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
      {isUploading && progress === null && onCancel ? (
        <span className="group/spinner absolute top-1 right-1 inline-flex size-5 items-center justify-center">
          <span
            role="status"
            aria-label={`Uploading ${attachment.name}`}
            className="inline-flex size-5 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm transition-opacity group-hover/spinner:opacity-0 group-focus-within/spinner:opacity-0"
          >
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          </span>
          <button
            type="button"
            aria-label={`Cancel uploading ${attachment.name}`}
            onClick={onCancel}
            className="absolute inset-0 inline-flex size-5 items-center justify-center rounded-full bg-text-secondary text-white opacity-0 shadow-sm transition-opacity hover:bg-secondary-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group-hover/spinner:opacity-100 group-focus-within/spinner:opacity-100"
          >
            <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
          </button>
        </span>
      ) : isUploading && progress === null ? (
        <span
          role="status"
          aria-label={`Uploading ${attachment.name}`}
          className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm"
        >
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        </span>
      ) : null}
      {onCancel && typeof progress === "number" ? (
        <button
          type="button"
          aria-label={`Cancel uploading ${attachment.name}`}
          onClick={onCancel}
          className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border border-white bg-text-secondary text-white shadow-sm transition-colors hover:bg-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${attachment.name}`}
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border border-white bg-text-secondary text-white shadow-sm transition-opacity hover:bg-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:opacity-0 sm:group-hover/attachment:opacity-100 sm:focus-visible:opacity-100"
        >
          <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}
