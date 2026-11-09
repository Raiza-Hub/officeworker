"use client";

import {
  ArrowUp,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { PreviewModal } from "@/components/agent/preview-modal";
import { prefetchAttachmentPreview } from "@/components/agent/preview-url-cache";

export type ChatAttachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MIN_TEXTAREA_HEIGHT = 54;
const MAX_COMPOSER_HEIGHT = 240;

type PendingAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
};

function attachmentFingerprint(file: {
  name: string;
  size: number;
  mediaType?: string;
  type?: string;
}) {
  return `${file.name}\u0000${file.size}\u0000${file.mediaType ?? file.type ?? "application/octet-stream"}`;
}

function AttachmentIcon({ mediaType, name }: Pick<ChatAttachment, "mediaType" | "name">) {
  const extension = name.split(".").pop()?.toLowerCase();
  const Icon = mediaType.startsWith("image/")
    ? FileImage
    : ["xls", "xlsx", "csv"].includes(extension ?? "")
      ? FileSpreadsheet
      : ["pdf", "doc", "docx", "txt"].includes(extension ?? "")
        ? FileText
        : File;

  return (
    <Icon
      aria-hidden="true"
      className="size-3.5 shrink-0 text-[#71747c]"
      strokeWidth={1.8}
    />
  );
}

type AgentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isGenerating?: boolean;
  isStopping?: boolean;
  onStop?: () => void;
  // Blocks send/attach only; typing stays allowed (used while the
  // thread's first message page is still loading).
  loading?: boolean;
  attachments?: ChatAttachment[];
  onAttachmentsChange?: Dispatch<SetStateAction<ChatAttachment[]>>;
};

async function readResponseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export async function uploadChatAttachment(
  file: File,
): Promise<ChatAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is larger than 25MB`);
  }
  const contentType = file.type || "application/octet-stream";
  const presignResponse = await fetch("/api/documents/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: contentType,
      fileSize: file.size,
    }),
  });
  if (!presignResponse.ok) {
    throw new Error(
      await readResponseError(
        presignResponse,
        `Could not prepare upload (${presignResponse.status})`,
      ),
    );
  }
  const presign = (await presignResponse.json()) as { url: string; key: string };
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
  return {
    key: presign.key,
    name: file.name,
    mediaType: contentType,
    size: file.size,
  };
}

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  isSubmitting = false,
  isGenerating = false,
  isStopping = false,
  onStop,
  loading = false,
  attachments = [],
  onAttachmentsChange,
}: AgentComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const isUploading = pendingAttachments.length > 0;
  const [previewAttachment, setPreviewAttachment] =
    useState<ChatAttachment | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const height = Math.max(
      MIN_TEXTAREA_HEIGHT,
      Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT),
    );
    textarea.style.height = `${height}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, [value]);

  function selectFiles() {
    fileInputRef.current?.click();
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || !onAttachmentsChange) return;

    const knownAttachments = new Set([
      ...attachments.map(attachmentFingerprint),
      ...pendingAttachments.map(attachmentFingerprint),
    ]);
    const acceptedFiles = files.filter((file) => {
      const fingerprint = attachmentFingerprint(file);
      if (knownAttachments.has(fingerprint)) {
        toast.error(`“${file.name}” is already attached`);
        return false;
      }
      knownAttachments.add(fingerprint);
      return true;
    });
    if (acceptedFiles.length === 0) return;

    const pending = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      size: file.size,
    }));
    const pendingIds = new Set(pending.map((attachment) => attachment.id));
    setPendingAttachments((current) => [...current, ...pending]);
    try {
      const uploaded = await Promise.allSettled(
        acceptedFiles.map((file) => uploadChatAttachment(file)),
      );
      const ok = uploaded
        .filter(
          (result): result is PromiseFulfilledResult<ChatAttachment> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);
      for (const result of uploaded) {
        if (result.status === "rejected") {
          toast.error(
            result.reason instanceof Error
              ? result.reason.message
              : "Upload failed",
          );
        }
      }
      if (ok.length > 0) {
        ok.forEach(prefetchAttachmentPreview);
        onAttachmentsChange((current) => [...current, ...ok]);
      }
    } finally {
      setPendingAttachments((current) =>
        current.filter((attachment) => !pendingIds.has(attachment.id)),
      );
    }
  }

  const canSend =
    (value.trim().length > 0 || attachments.length > 0) &&
    !isSubmitting &&
    !isUploading &&
    !loading;

  return (
    <>
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
      className="relative z-10 w-full"
    >
      <div className="flex min-h-[104px] flex-col rounded-[11px] border border-[#e7e7e9] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.035)] transition-[border-color,box-shadow] focus-within:border-[#d9dae0] focus-within:shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {(attachments.length > 0 || pendingAttachments.length > 0) && (
          <ul
            aria-label="Attached files"
            className="mb-2 flex list-none flex-wrap gap-1.5 p-0"
          >
            {attachments.map((attachment) => (
              <li
                key={attachment.key}
                className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-full bg-[#f4f4f5] pl-2.5 pr-1 text-[12px] leading-none font-[450] text-[#45474e]"
              >
                <button
                  type="button"
                  aria-label={`Preview ${attachment.name}`}
                  title={`Preview ${attachment.name}`}
                  onPointerEnter={() => prefetchAttachmentPreview(attachment)}
                  onFocus={() => prefetchAttachmentPreview(attachment)}
                  onClick={() => setPreviewAttachment(attachment)}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-full py-1 text-left hover:text-[#24252a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/50"
                >
                  <AttachmentIcon
                    mediaType={attachment.mediaType}
                    name={attachment.name}
                  />
                  <span className="truncate">{attachment.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() =>
                    onAttachmentsChange?.(
                      attachments.filter(
                        (candidate) => candidate.key !== attachment.key,
                      ),
                    )
                  }
                  disabled={isUploading}
                  className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[#85878e] transition-colors hover:bg-[#e4e4e7] hover:text-[#303137] disabled:opacity-50"
                >
                  <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
                </button>
              </li>
            ))}
            {pendingAttachments.map((attachment) => (
              <li
                key={attachment.id}
                aria-label={`Uploading ${attachment.name}`}
                className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-full bg-[#f4f4f5] px-2.5 text-[12px] leading-none font-[450] text-[#45474e]"
              >
                <AttachmentIcon
                  mediaType={attachment.mediaType}
                  name={attachment.name}
                />
                <span className="truncate">{attachment.name}</span>
                <LoaderCircle
                  aria-label="Uploading"
                  className="size-3.5 shrink-0 animate-spin text-[#626bd9]"
                />
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={textareaRef}
          aria-label="Message the assistant"
          placeholder="Ask Officeworker…"
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          className="w-full shrink-0 resize-none bg-transparent text-[15px] leading-6 text-[#25262b] outline-none placeholder:text-[#85878e]"
          style={{ minHeight: MIN_TEXTAREA_HEIGHT }}
        />
        <div className="mt-auto flex h-6 shrink-0 items-center justify-between">
          {onAttachmentsChange ? (
            <button
              type="button"
              aria-label="Attach a file"
              onClick={selectFiles}
              disabled={isSubmitting || loading}
              className="inline-flex size-7 items-center justify-center rounded-full text-[#71747c] transition-colors hover:bg-[#f3f3f4] hover:text-[#303137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35 disabled:opacity-50"
            >
              <Paperclip aria-hidden="true" className="size-3.5" strokeWidth={2} />
            </button>
          ) : (
            <span />
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />
          <button
            type={isGenerating ? "button" : "submit"}
            aria-label={isGenerating ? "Stop generation" : "Send message"}
            onClick={isGenerating ? onStop : undefined}
            disabled={isGenerating ? isStopping : !canSend}
            className="inline-flex size-7 items-center justify-center rounded-full bg-[#626bd9] text-white transition-[background-color,transform] duration-100 hover:bg-[#555fc9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2 active:scale-95 disabled:bg-[#c9cae4] disabled:text-white/80"
          >
            {isGenerating ? (
              <Square aria-hidden="true" className="size-3.5" fill="currentColor" strokeWidth={1.5} />
            ) : (
              <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.4} />
            )}
          </button>
        </div>
      </div>
    </form>
    {previewAttachment && (
      <PreviewModal
        storageKey={previewAttachment.key}
        filename={previewAttachment.name}
        mediaType={previewAttachment.mediaType}
        onClose={() => setPreviewAttachment(null)}
      />
    )}
    </>
  );
}
