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
  checkObjectExists,
  completeMultipartUpload,
  listUploadedParts,
  planPartCount,
  presignDocumentUpload,
  putObjectToR2WithProgress,
  UploadCanceledError,
  uploadMultipartResumable,
  type PresignResult,
} from "@/lib/attachments";
import { BLOCKED_MEDIA_MESSAGE, isBlockedMediaFile } from "@/lib/blocked-media";
import {
  deleteUpload as deleteStoredUpload,
  findUploadByStorageKey,
  listUploads,
  saveUpload,
  updateUpload,
  type StoredUpload,
} from "@/lib/upload-store";

const FALLBACK_CONTENT_TYPE = "application/octet-stream";
const CONFIRM_RETRY_DELAYS_MS = [500, 1000, 2000];

export type DocumentUploadItem = {
  id: string;
  file: File;
  name: string;
  storageKey: string | null;
  uploadId: string | null;
  progress: number;
  phase: "preparing" | "uploading" | "canceling" | "failed";
};

type StaleDoc = {
  _id: Id<"documents">;
  storageKey: string;
  name: string;
  type: string;
  size: number;
};

type DocumentUploadsContextValue = {
  items: DocumentUploadItem[];
  startUploads: (files: File[]) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  dismissUpload: (id: string) => void;
  activeCount: number;
  resumeStaleUpload: (doc: StaleDoc) => void;
};

const DocumentUploadsContext = createContext<DocumentUploadsContextValue | null>(null);

function patchItem(
  setItems: React.Dispatch<React.SetStateAction<DocumentUploadItem[]>>,
  id: string,
  patch: Partial<DocumentUploadItem>,
) {
  setItems((current) =>
    current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  );
}

async function deleteUploadedObject(storageKey: string) {
  await fetch("/api/documents/object", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: storageKey }),
  }).catch(() => undefined);
}

function isNoSuchUploadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return message.toLowerCase().includes("upload session not found");
}

export function DocumentUploadsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DocumentUploadItem[]>([]);
  const resolvingRef = useRef<Set<string>>(new Set());
  const cancelControllersRef = useRef<Map<string, AbortController>>(new Map());

  const createDocument = useMutation(api.documents.createDocument);
  const setDocumentSuccess = useMutation(api.documents.setDocumentSuccess);
  const setDocumentStorageKey = useMutation(api.documents.setDocumentStorageKey);
  const deleteDocument = useMutation(api.documents.deleteDocument);

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
      setItems((current) => {
        const target = current.find((item) => item.id === id);
        if (!target) return current;
        const next: DocumentUploadItem = {
          ...target,
          storageKey: null,
          uploadId: null,
          progress: 0,
          phase: "preparing",
        };
        void runUpload(next);
        return current.map((item) => (item.id === id ? next : item));
      });
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

      void (async () => {
        const contentType = doc.type || FALLBACK_CONTENT_TYPE;

        const removeTracker = (trackerId: string) => {
          setItems((current) => current.filter((item) => item.id !== trackerId));
        };

        const ensureTracker = (
          trackerId: string,
          file: File,
          storageKey: string | null,
          uploadId: string | null,
        ) => {
          setItems((current) => {
            if (current.some((item) => item.id === trackerId)) return current;
            return [
              ...current,
              {
                id: trackerId,
                file,
                name: file.name,
                storageKey,
                uploadId,
                progress: 0,
                phase: "uploading",
              },
            ];
          });
        };

        let controller: AbortController | null = null;
        const isCanceled = (error: unknown) =>
          (controller?.signal.aborted ?? false) || error instanceof UploadCanceledError;

        const cleanupCanceled = async (args: {
          trackerId: string;
          entryId?: string;
          storageKey?: string | null;
          uploadId?: string | null;
        }) => {
          const { trackerId, entryId, storageKey, uploadId } = args;
          patchItem(setItems, trackerId, { phase: "canceling" });
          if (uploadId && storageKey) {
            await abortMultipartUpload(storageKey, uploadId).catch(() => undefined);
          }
          if (storageKey) {
            await deleteUploadedObject(storageKey);
          }
          await deleteDocument({ id: doc._id }).catch(() => undefined);
          if (entryId) {
            await deleteStoredUpload(entryId);
          }
          removeTracker(trackerId);
        };

        const uploadPresignToRecord = async (
          trackerId: string,
          entry: StoredUpload,
          presign: PresignResult,
        ) => {
          if (!controller) throw new UploadCanceledError();
          const assertNotCanceled = () => {
            if (controller!.signal.aborted) {
              throw controller!.signal.reason ?? new UploadCanceledError();
            }
          };
          assertNotCanceled();
          await setDocumentStorageKey({ id: doc._id, storageKey: presign.key });
          assertNotCanceled();
          if (presign.mode === "multipart") {
            patchItem(setItems, trackerId, {
              storageKey: presign.key,
              uploadId: presign.uploadId,
              progress: 0,
              phase: "uploading",
            });
            await updateUpload(entry.id, {
              storageKey: presign.key,
              uploadId: presign.uploadId,
              partSize: presign.partSize,
            });
            assertNotCanceled();
            await uploadMultipartResumable({
              file: entry.blob,
              key: presign.key,
              uploadId: presign.uploadId,
              contentType: entry.type || contentType,
              partSize: presign.partSize,
              partUrls: presign.partUrls,
              uploadedParts: [],
              onProgress: (percent) => {
                patchItem(setItems, trackerId, { progress: percent });
              },
              signal: controller.signal,
            });
            assertNotCanceled();
            await completeMultipartUpload(presign.key, presign.uploadId);
          } else {
            patchItem(setItems, trackerId, {
              storageKey: presign.key,
              uploadId: null,
              progress: 0,
              phase: "uploading",
            });
            await updateUpload(entry.id, {
              storageKey: presign.key,
              uploadId: null,
              partSize: null,
            });
            assertNotCanceled();
            await putObjectToR2WithProgress(
              presign.url,
              entry.blob,
              entry.type || contentType,
              (percent) => {
                patchItem(setItems, trackerId, { progress: percent });
              },
              controller.signal,
            );
          }
          assertNotCanceled();
          patchItem(setItems, trackerId, { progress: 100 });
          assertNotCanceled();
          await confirmDocumentSuccess(doc._id, doc.name);
          await deleteStoredUpload(entry.id);
          removeTracker(trackerId);
        };

        try {
          const entry = await findUploadByStorageKey(doc.storageKey);

          if (entry && entry.uploadId && entry.partSize && entry.storageKey) {
            const trackerId = entry.id;
            const blob = new File([entry.blob], entry.name, {
              type: entry.type || contentType,
            });
            controller = new AbortController();
            cancelControllersRef.current.set(trackerId, controller);
            ensureTracker(trackerId, blob, entry.storageKey, entry.uploadId);

            try {
              const totalParts = planPartCount(entry.size, entry.partSize);
              const { parts, partUrls } = await listUploadedParts(
                entry.storageKey,
                entry.uploadId,
                totalParts,
              );
              if (controller.signal.aborted) throw controller.signal.reason ?? new UploadCanceledError();
              await uploadMultipartResumable({
                file: entry.blob,
                key: entry.storageKey,
                uploadId: entry.uploadId,
                contentType: entry.type || contentType,
                partSize: entry.partSize,
                partUrls,
                uploadedParts: parts,
                onProgress: (percent) => {
                  patchItem(setItems, trackerId, { progress: percent });
                },
                signal: controller.signal,
              });
              if (controller.signal.aborted) throw controller.signal.reason ?? new UploadCanceledError();
              await completeMultipartUpload(entry.storageKey, entry.uploadId);
              if (controller.signal.aborted) throw controller.signal.reason ?? new UploadCanceledError();
              patchItem(setItems, trackerId, { progress: 100 });
              await confirmDocumentSuccess(doc._id, doc.name);
              await deleteStoredUpload(entry.id);
              removeTracker(trackerId);
              return;
            } catch (error) {
              if (isCanceled(error)) {
                await cleanupCanceled({
                  trackerId,
                  entryId: entry.id,
                  storageKey: entry.storageKey,
                  uploadId: entry.uploadId,
                });
                return;
              }
              if (isNoSuchUploadError(error)) {
                await abortMultipartUpload(entry.storageKey, entry.uploadId).catch(
                  () => undefined,
                );

                let presign: PresignResult | null = null;
                try {
                  if (controller.signal.aborted) throw controller.signal.reason ?? new UploadCanceledError();
                  presign = await presignDocumentUpload(
                    {
                      name: entry.name,
                      size: entry.size,
                      type: entry.type || contentType,
                    },
                    controller.signal,
                  );
                  await uploadPresignToRecord(trackerId, entry, presign);
                  return;
                } catch (restartError) {
                  if (isCanceled(restartError)) {
                    await cleanupCanceled({
                      trackerId,
                      entryId: entry.id,
                      storageKey: presign?.key ?? null,
                      uploadId:
                        presign?.mode === "multipart" ? presign.uploadId : null,
                    });
                    return;
                  }
                  if (presign) {
                    if (presign.mode === "multipart") {
                      await abortMultipartUpload(presign.key, presign.uploadId).catch(
                        () => undefined,
                      );
                    }
                    await deleteUploadedObject(presign.key);
                  }
                  removeTracker(trackerId);
                  toast.error("Something went wrong. Please try again");
                  return;
                }
              }

              removeTracker(trackerId);
              toast.error("Something went wrong. Please try again");
              return;
            } finally {
              cancelControllersRef.current.delete(trackerId);
            }
          }

          if (entry && entry.storageKey && !entry.uploadId) {
            const trackerId = entry.id;
            const blob = new File([entry.blob], entry.name, {
              type: entry.type || contentType,
            });
            controller = new AbortController();
            cancelControllersRef.current.set(trackerId, controller);
            ensureTracker(trackerId, blob, entry.storageKey, null);

            let presign: PresignResult | null = null;
            try {
              if (controller.signal.aborted) throw controller.signal.reason ?? new UploadCanceledError();
              presign = await presignDocumentUpload(
                {
                  name: entry.name,
                  size: entry.size,
                  type: entry.type || contentType,
                },
                controller.signal,
              );
              await uploadPresignToRecord(trackerId, entry, presign);
              return;
            } catch (error) {
              if (isCanceled(error)) {
                await cleanupCanceled({
                  trackerId,
                  entryId: entry.id,
                  storageKey: presign?.key ?? null,
                  uploadId: presign?.mode === "multipart" ? presign.uploadId : null,
                });
                return;
              }
              if (presign) {
                if (presign.mode === "multipart") {
                  await abortMultipartUpload(presign.key, presign.uploadId).catch(
                    () => undefined,
                  );
                }
                await deleteUploadedObject(presign.key);
              }
              removeTracker(trackerId);
              toast.error("Something went wrong. Please try again");
              return;
            } finally {
              cancelControllersRef.current.delete(trackerId);
            }
          }

          try {
            const exists = await checkObjectExists(doc.storageKey);
            if (exists) {
              await confirmDocumentSuccess(doc._id, doc.name);
            } else {
              await deleteDocument({ id: doc._id }).catch(() => undefined);
              await deleteUploadedObject(doc.storageKey);
              toast.error("Something went wrong. Please try again");
            }
          } catch {
            resolvingRef.current.delete(docId);
          }
        } finally {
          // keep resolved entries in ref to avoid reprocessing in this session
        }
      })();
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
