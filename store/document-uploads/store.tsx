"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  presignDocumentUpload,
  putObjectToR2WithProgress,
  UploadCanceledError,
  uploadMultipartResumable,
} from "@/lib/attachments";
import { BLOCKED_MEDIA_MESSAGE, isBlockedMediaFile } from "@/lib/blocked-media";
import {
  deleteUpload as deleteStoredUpload,
  listUploads,
  saveUpload,
  updateUpload,
} from "@/lib/upload-store";
import { CONFIRM_RETRY_DELAYS_MS, FALLBACK_CONTENT_TYPE } from "./constants";
import { resolveStaleUpload } from "./resolve-stale-upload";
import type {
  DocumentUploadItem,
  DocumentUploadsContextValue,
  StaleDoc,
} from "./types";
import { deleteUploadedObject, patchItem } from "./upload-helpers";

const DocumentUploadsContext = createContext<DocumentUploadsContextValue | null>(null);

export function DocumentUploadsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DocumentUploadItem[]>([]);
  const itemsRef = useRef(items);
  const resolvingRef = useRef<Set<string>>(new Set());
  const cancelControllersRef = useRef<Map<string, AbortController>>(new Map());

  const createDocument = useMutation(api.documents.createDocument);
  const setDocumentSuccess = useMutation(api.documents.setDocumentSuccess);
  const setDocumentStorageKey = useMutation(api.documents.setDocumentStorageKey);
  const deleteDocument = useMutation(api.documents.deleteDocument);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    void (async () => {
      const all = await listUploads();
      const now = Date.now();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      await Promise.all(
        all
          .filter((entry) => now - entry.createdAt > maxAgeMs)
          .map((entry) => deleteStoredUpload(entry.id)),
      );
    })();
  }, []);

  const confirmDocumentSuccess = useCallback(
    async (documentId: Id<"documents">, fileName: string) => {
      for (let attempt = 0; attempt <= CONFIRM_RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, CONFIRM_RETRY_DELAYS_MS[attempt - 1]),
          );
        }
        try {
          await setDocumentSuccess({ id: documentId });
          return "success" as const;
        } catch {
          // retry
        }
      }
      toast.error(
        `"${fileName}" uploaded, but the confirmation update failed. The document stays listed as uploading until it syncs.`,
      );
      return "confirm-failed" as const;
    },
    [setDocumentSuccess],
  );

  const runUpload = useCallback(
    async (item: DocumentUploadItem) => {
      const { id, file } = item;
      let storageKey: string | null = null;
      let uploadId: string | null = null;
      let documentId: Id<"documents"> | null = null;
      const storeId = id;
      const contentType = file.type || FALLBACK_CONTENT_TYPE;
      const controller = new AbortController();
      cancelControllersRef.current.set(id, controller);
      const assertNotCanceled = () => {
        if (controller.signal.aborted) {
          throw controller.signal.reason ?? new UploadCanceledError();
        }
      };

      try {
        await saveUpload({
          id: storeId,
          name: file.name,
          type: contentType,
          size: file.size,
          blob: file,
          storageKey: null,
          uploadId: null,
          partSize: null,
          doneParts: [],
          createdAt: Date.now(),
        });
        assertNotCanceled();

        const presign = await presignDocumentUpload(
          {
            name: file.name,
            size: file.size,
            type: contentType,
          },
          controller.signal,
        );
        assertNotCanceled();
        storageKey = presign.key;
        if (presign.mode === "multipart") {
          uploadId = presign.uploadId;
          patchItem(setItems, id, {
            storageKey,
            uploadId,
            phase: "uploading",
            progress: 0,
          });
          await updateUpload(storeId, {
            storageKey,
            uploadId,
            partSize: presign.partSize,
          });
        } else {
          patchItem(setItems, id, { storageKey, phase: "uploading", progress: 0 });
          await updateUpload(storeId, { storageKey });
        }
        assertNotCanceled();

        documentId = (await createDocument({
          name: file.name,
          type: contentType,
          size: file.size,
          storageKey: presign.key,
        })) as Id<"documents">;
        assertNotCanceled();

        if (presign.mode === "multipart") {
          await uploadMultipartResumable({
            file,
            key: presign.key,
            uploadId: presign.uploadId,
            contentType,
            partSize: presign.partSize,
            partUrls: presign.partUrls,
            uploadedParts: [],
            onProgress: (percent) => {
              patchItem(setItems, id, { progress: percent });
            },
            signal: controller.signal,
          });
          assertNotCanceled();
          await completeMultipartUpload(presign.key, presign.uploadId);
        } else {
          await putObjectToR2WithProgress(
            presign.url,
            file,
            contentType,
            (percent) => {
              patchItem(setItems, id, { progress: percent });
            },
            controller.signal,
          );
        }
        assertNotCanceled();

        patchItem(setItems, id, { progress: 100 });
        assertNotCanceled();
        await confirmDocumentSuccess(documentId, file.name);
        await deleteStoredUpload(storeId);
        setItems((current) => current.filter((entry) => entry.id !== id));
      } catch (error) {
        const canceled =
          controller.signal.aborted || error instanceof UploadCanceledError;
        if (canceled) {
          patchItem(setItems, id, { phase: "canceling" });
        }
        if (uploadId && storageKey) {
          await abortMultipartUpload(storageKey, uploadId);
        }
        if (storageKey) {
          await deleteUploadedObject(storageKey);
        }
        if (documentId) {
          await deleteDocument({ id: documentId }).catch(() => undefined);
        }
        await deleteStoredUpload(storeId);
        if (canceled) {
          setItems((current) => current.filter((entry) => entry.id !== id));
        } else {
          patchItem(setItems, id, { phase: "failed", progress: 0 });
          toast.error(
            error instanceof Error
              ? `Failed to upload "${file.name}" — ${error.message}`
              : `Failed to upload "${file.name}"`,
          );
        }
      } finally {
        cancelControllersRef.current.delete(id);
      }
    },
    [confirmDocumentSuccess, createDocument, deleteDocument],
  );

  const startUploads = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const accepted = files.filter((file) => {
        if (isBlockedMediaFile(file)) {
          toast.error(`"${file.name}" — ${BLOCKED_MEDIA_MESSAGE}`);
          return false;
        }
        return true;
      });
      if (accepted.length === 0) return;

      const newItems: DocumentUploadItem[] = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        storageKey: null,
        uploadId: null,
        progress: 0,
        phase: "preparing",
      }));
      setItems((current) => [...current, ...newItems]);
      for (const item of newItems) {
        void runUpload(item);
      }
    },
    [runUpload],
  );

  const retryUpload = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((item) => item.id === id);
      if (!target) return;
      const next: DocumentUploadItem = {
        ...target,
        storageKey: null,
        uploadId: null,
        progress: 0,
        phase: "preparing",
      };
      setItems((current) => current.map((item) => (item.id === id ? next : item)));
      void runUpload(next);
    },
    [runUpload],
  );

  const cancelUpload = useCallback((id: string) => {
    const controller = cancelControllersRef.current.get(id);
    if (controller) {
      controller.abort(new UploadCanceledError());
    }
  }, []);

  const dismissUpload = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const resumeStaleUpload = useCallback(
    (doc: StaleDoc) => {
      const docId = String(doc._id);
      if (resolvingRef.current.has(docId)) return;
      resolvingRef.current.add(docId);

      void resolveStaleUpload({
        doc,
        docId,
        setItems,
        resolvingRef,
        cancelControllersRef,
        confirmDocumentSuccess,
        deleteDocument,
        setDocumentStorageKey,
      });
    },
    [confirmDocumentSuccess, deleteDocument, setDocumentStorageKey],
  );

  const activeCount = useMemo(
    () => items.filter((item) => item.phase !== "failed").length,
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      startUploads,
      retryUpload,
      cancelUpload,
      dismissUpload,
      activeCount,
      resumeStaleUpload,
    }),
    [activeCount, cancelUpload, dismissUpload, items, resumeStaleUpload, retryUpload, startUploads],
  );

  return (
    <DocumentUploadsContext.Provider value={value}>
      {children}
    </DocumentUploadsContext.Provider>
  );
}

export function useDocumentUploads() {
  const context = useContext(DocumentUploadsContext);
  if (!context) {
    throw new Error("useDocumentUploads must be used within DocumentUploadsProvider");
  }
  return context;
}
