"use client";

import { Plus, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { presignUpload, putObjectToR2 } from "@/lib/attachments";
import { BLOCKED_MEDIA_MESSAGE, isBlockedMediaFile } from "@/lib/blocked-media";

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

type UploadDocumentsButtonProps = {
  label?: string;
  icon?: "upload" | "plus";
  className?: string;
};

export function UploadDocumentsButton({
  label = "Upload",
  icon = "upload",
  className,
}: UploadDocumentsButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const createDocument = useMutation(api.documents.createDocument);
  const setDocumentSuccess = useMutation(api.documents.setDocumentSuccess);
  const deleteDocument = useMutation(api.documents.deleteDocument);

  function selectFiles() {
    fileInputRef.current?.click();
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const acceptedFiles = files.filter((file) => {
      if (isBlockedMediaFile(file)) {
        toast.error(`"${file.name}" — ${BLOCKED_MEDIA_MESSAGE}`);
        return false;
      }
      return true;
    });
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    try {
      await Promise.allSettled(acceptedFiles.map((file) => beginUpload(file)));
    } finally {
      setIsUploading(false);
    }
  }

  function beginUpload(file: File) {
    return toast.promise(uploadFile(file), {
      loading: `Uploading "${file.name}"…`,
      success: `"${file.name}" uploaded`,
      error: (error) => (error instanceof Error ? error.message : `Failed to upload "${file.name}"`),
    });
  }

  async function uploadFile(file: File) {
    const contentType = file.type || FALLBACK_CONTENT_TYPE;
    const presign = await presignUpload({
      name: file.name,
      size: file.size,
      type: contentType,
    });
    const documentId = (await createDocument({
      name: file.name,
      type: contentType,
      size: file.size,
      storageKey: presign.key,
    })) as Id<"documents">;

    try {
      await putObjectToR2(presign.url, file, contentType);
    } catch (error) {
      // The upload may have written the object before the client saw the
      // failure, so ask the server to remove it before dropping the record.
      await fetch("/api/documents/object", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: presign.key }),
      }).catch(() => undefined);
      await deleteDocument({ id: documentId }).catch(() => undefined);
      throw error;
    }

    await confirmDocumentSuccess(documentId, file.name);
  }

  async function confirmDocumentSuccess(documentId: Id<"documents">, fileName: string) {
    const retryDelaysMs = [500, 1000, 2000];
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1]));
      }
      try {
        await setDocumentSuccess({ id: documentId });
        return;
      } catch {}
    }
    // The R2 object is stored and its record still exists, so the record is
    // kept (status stays "Uploading") instead of being deleted, which would
    // orphan the object in R2. Retrying or deleting the row can reconcile it.
    throw new Error(
      `"${fileName}" uploaded, but the confirmation update failed. The document stays listed as "Uploading" until it syncs.`,
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFilesChange}
      />
      <button
        type="button"
        onClick={selectFiles}
        disabled={isUploading}
        aria-busy={isUploading}
        className={
          className ??
          "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] leading-4 font-medium text-[#5c5f67] transition-colors hover:bg-[#f0f0f2] hover:text-[#292a30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40 disabled:pointer-events-none disabled:opacity-60"
        }
      >
        {icon === "plus" ? (
          <Plus
            aria-hidden="true"
            className={`size-4${isUploading ? " animate-pulse" : ""}`}
            strokeWidth={2.2}
          />
        ) : (
          <Upload
            aria-hidden="true"
            className={`size-3.5${isUploading ? " animate-pulse" : ""}`}
            strokeWidth={2}
          />
        )}
        {isUploading ? "Uploading…" : label}
      </button>
    </>
  );
}
