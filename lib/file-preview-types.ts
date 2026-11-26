export type PreviewAttachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

export type XlsxViewerSaveApi = {
  getBytes: () => Uint8Array | null;
};
