"use client";

import { toast } from "sonner";
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
import {
  deleteUpload as deleteStoredUpload,
  findUploadByStorageKey,
  updateUpload,
  type StoredUpload,
} from "@/lib/upload-store";
import { FALLBACK_CONTENT_TYPE } from "./constants";
import type { StaleUploadDeps } from "./types";
import {
  deleteUploadedObject,
  isNoSuchUploadError,
  patchItem,
} from "./upload-helpers";

export async function resolveStaleUpload({
  doc,
  docId,
  setItems,
  resolvingRef,
  cancelControllersRef,
  confirmDocumentSuccess,
  deleteDocument,
  setDocumentStorageKey,
}: StaleUploadDeps) {
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
}
