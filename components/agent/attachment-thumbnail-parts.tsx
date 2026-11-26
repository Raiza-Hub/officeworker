"use client";

import dynamic from "next/dynamic";
import { LoaderCircle, X } from "lucide-react";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import { SquishProgressBar } from "@/components/ui/squish-progress-bar";
import type { AttachmentThumbnailData } from "@/hooks/use-attachment-preview-source";
import { isPreviewSupported } from "@/lib/file-types";
import { showPreviewUnsupportedToast } from "@/lib/preview-errors";

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

type Progress = number | "indeterminate" | null;

export function AttachmentPreviewContent({
  attachment,
  fileUrl,
  sourceError,
  isUploading,
  progress,
  footer,
  nameLines,
}: {
  attachment: AttachmentThumbnailData;
  fileUrl: string | null;
  sourceError: boolean;
  isUploading: boolean;
  progress: Progress;
  footer?: React.ReactNode;
  nameLines: 1 | 2;
}) {
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

  return (
    <>
      <AttachmentThumbnailPreview
        attachment={attachment}
        fileUrl={fileUrl}
        isUploading={isUploading || progress !== null}
        sourceError={sourceError}
      />
      <span
        title={attachment.name}
        className={`mt-1 block w-full text-left text-[11px] leading-4 text-text-secondary ${nameLines === 2 ? "line-clamp-2 break-words" : "truncate"}`}
      >
        {attachment.name}
      </span>
      {progressBar}
      {footer ? <div className="mt-1.5">{footer}</div> : null}
    </>
  );
}

export function AttachmentPreviewWrapper({
  attachment,
  onPreview,
  fileUrl,
  sourceError,
  isUploading,
  progress,
  footer,
  nameLines,
}: {
  attachment: AttachmentThumbnailData;
  onPreview?: () => void;
  fileUrl: string | null;
  sourceError: boolean;
  isUploading: boolean;
  progress: Progress;
  footer?: React.ReactNode;
  nameLines: 1 | 2;
}) {
  const previewSupported = isPreviewSupported(attachment.name, attachment.mediaType);
  const canPreview = Boolean(onPreview) && previewSupported;
  const canShowPreviewError = Boolean(onPreview) && !previewSupported;
  const preview = (
    <AttachmentPreviewContent
      attachment={attachment}
      fileUrl={fileUrl}
      sourceError={sourceError}
      isUploading={isUploading}
      progress={progress}
      footer={footer}
      nameLines={nameLines}
    />
  );

  return canPreview ? (
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
        showPreviewUnsupportedToast(attachment.key ?? attachment.name)
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
  );
}

export function AttachmentUploadControls({
  attachment,
  isUploading,
  progress,
  onCancel,
}: {
  attachment: AttachmentThumbnailData;
  isUploading: boolean;
  progress: Progress;
  onCancel?: () => void;
}) {
  if (isUploading && progress === null && onCancel) {
    return (
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
    );
  }

  if (isUploading && progress === null) {
    return (
      <span
        role="status"
        aria-label={`Uploading ${attachment.name}`}
        className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm"
      >
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
      </span>
    );
  }

  if (onCancel && typeof progress === "number") {
    return (
      <button
        type="button"
        aria-label={`Cancel uploading ${attachment.name}`}
        onClick={onCancel}
        className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border border-white bg-text-secondary text-white shadow-sm transition-colors hover:bg-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
      </button>
    );
  }

  return null;
}

export function AttachmentRemoveButton({
  attachment,
  onRemove,
}: {
  attachment: AttachmentThumbnailData;
  onRemove?: () => void;
}) {
  return onRemove ? (
    <button
      type="button"
      aria-label={`Remove ${attachment.name}`}
      onClick={onRemove}
      className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border border-white bg-text-secondary text-white shadow-sm transition-opacity hover:bg-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:opacity-0 sm:group-hover/attachment:opacity-100 sm:focus-visible:opacity-100"
    >
      <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
    </button>
  ) : null;
}
