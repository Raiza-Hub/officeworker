"use client";

import {
  useAttachmentPreviewSource,
  type AttachmentThumbnailData,
} from "@/hooks/use-attachment-preview-source";
import {
  AttachmentPreviewWrapper,
  AttachmentRemoveButton,
  AttachmentUploadControls,
} from "./attachment-thumbnail-parts";

export type { AttachmentThumbnailData };

export function AttachmentThumbnail({
  attachment,
  onPreview,
  onRemove,
  isUploading = false,
  className = "w-28",
  nameLines = 1,
  showName = true,
  progress = null,
  footer,
  onCancel,
}: {
  attachment: AttachmentThumbnailData;
  onPreview?: () => void;
  onRemove?: () => void;
  isUploading?: boolean;
  className?: string;
  nameLines?: 1 | 2;
  showName?: boolean;
  progress?: number | "indeterminate" | null;
  footer?: React.ReactNode;
  onCancel?: () => void;
}) {
  const { fileUrl, sourceError } = useAttachmentPreviewSource(attachment);

  return (
    <div className={`group/attachment relative shrink-0 ${className}`}>
      <AttachmentPreviewWrapper
        attachment={attachment}
        onPreview={onPreview}
        fileUrl={fileUrl}
        sourceError={sourceError}
        isUploading={isUploading}
        progress={progress}
        footer={footer}
        nameLines={nameLines}
        showName={showName}
      />
      <AttachmentUploadControls
        attachment={attachment}
        isUploading={isUploading}
        progress={progress}
        onCancel={onCancel}
      />
      <AttachmentRemoveButton attachment={attachment} onRemove={onRemove} />
    </div>
  );
}
