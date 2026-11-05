"use client";

import { Plus, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

type UploadDocumentsButtonProps = {
  label?: string;
  icon?: "upload" | "plus";
  className?: string;
};

async function readResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.length > 0) return data.error;
  } catch {
    return fallback;
  }
  return fallback;
}

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

    setIsUploading(true);
    await Promise.allSettled(files.map((file) => beginUpload(file)));
    setIsUploading(false);
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
    const presignResponse = await fetch("/api/documents/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, fileType: contentType, fileSize: file.size }),
    });
    if (!presignResponse.ok) {
      throw new Error(await readResponseError(presignResponse, `Could not prepare upload (${presignResponse.status})`));
    }

    const presign = (await presignResponse.json()) as { url: string; key: string };
    const documentId = (await createDocument({
      name: file.name,
      type: contentType,
      size: file.size,
      storageKey: presign.key,
    })) as Id<"documents">;

    try {
      const uploadResponse = await fetch(presign.url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(
          uploadResponse.status === 403
            ? "R2 rejected the upload (403). Check the bucket CORS policy and Content-Type, then try again."
            : `R2 upload failed (${uploadResponse.status})`,
        );
      }
      await setDocumentSuccess({ id: documentId });
    } catch (error) {
      await deleteDocument({ id: documentId }).catch(() => undefined);
      throw error;
    }
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
