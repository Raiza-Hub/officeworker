import type * as React from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type DocumentUploadItem = {
  id: string;
  file: File;
  name: string;
  storageKey: string | null;
  uploadId: string | null;
  progress: number;
  phase: "preparing" | "uploading" | "canceling" | "failed";
};

export type StaleDoc = {
  _id: Id<"documents">;
  storageKey: string;
  name: string;
  type: string;
  size: number;
};

export type DocumentUploadsContextValue = {
  items: DocumentUploadItem[];
  startUploads: (files: File[]) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  dismissUpload: (id: string) => void;
  activeCount: number;
  resumeStaleUpload: (doc: StaleDoc) => void;
};

export type StaleUploadDeps = {
  doc: StaleDoc;
  docId: string;
  setItems: React.Dispatch<React.SetStateAction<DocumentUploadItem[]>>;
  resolvingRef: { current: Set<string> };
  cancelControllersRef: { current: Map<string, AbortController> };
  confirmDocumentSuccess: (
    documentId: Id<"documents">,
    fileName: string,
  ) => Promise<"success" | "confirm-failed">;
  deleteDocument: (args: { id: Id<"documents"> }) => Promise<unknown>;
  setDocumentStorageKey: (args: {
    id: Id<"documents">;
    storageKey: string;
  }) => Promise<unknown>;
};
