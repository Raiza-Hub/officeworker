"use client";

import { Plus, Upload } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { useDocumentUploads } from "@/components/documents/document-uploads-context";

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
  const { startUploads, activeCount } = useDocumentUploads();
  const isUploading = activeCount > 0;

  function selectFiles() {
    fileInputRef.current?.click();
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    startUploads(files);
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
          "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] leading-4 font-medium text-[#5c5f67] transition-colors hover:bg-surface-hover-soft hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40 disabled:pointer-events-none disabled:opacity-60"
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
