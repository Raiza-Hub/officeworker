export type AttachmentFile = {
  name: string;
  mediaType: string;
};

export type AttachmentThumbnailPreviewProps = {
  attachment: AttachmentFile;
  fileUrl: string | null;
  isUploading: boolean;
  sourceError: boolean;
};
