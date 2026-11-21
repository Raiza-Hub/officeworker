"use client";

import { ArrowUp, Paperclip, Square } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import {
  attachmentFingerprint,
  deleteUploadedObject,
  isUploadCanceledError,
  UploadCanceledError,
  uploadChatAttachment,
  type ChatAttachment,
} from "@/lib/attachments";
import { BLOCKED_MEDIA_MESSAGE, isBlockedMediaFile } from "@/lib/blocked-media";
import { AttachmentThumbnail } from "@/components/agent/attachment-thumbnail";
import { PreviewModal } from "@/components/agent/preview-modal";

const MIN_TEXTAREA_HEIGHT = 60;
const MAX_COMPOSER_HEIGHT = 240;

type PendingAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  controller: AbortController;
};

type PendingUpload = {
  id: string;
  file: File;
  controller: AbortController;
};

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

function collectAcceptedFiles(files: File[], knownFingerprints: Set<string>) {
  return files.filter((file) => {
    if (isBlockedMediaFile(file)) {
      toast.error(`"${file.name}" — ${BLOCKED_MEDIA_MESSAGE}`);
      return false;
    }
    const fingerprint = attachmentFingerprint(file);
    if (knownFingerprints.has(fingerprint)) {
      toast.error(`“${file.name}” is already attached`);
      return false;
    }
    knownFingerprints.add(fingerprint);
    return true;
  });
}

function toPendingUpload(file: File): PendingUpload {
  return {
    id: crypto.randomUUID(),
    file,
    controller: new AbortController(),
  };
}

async function uploadAcceptedFiles(
  pendingUploads: PendingUpload[],
  onAttachmentsChange: Dispatch<SetStateAction<ChatAttachment[]>>,
) {
  const uploaded = await Promise.allSettled(
    pendingUploads.map(({ file, controller }) =>
      uploadChatAttachment(file, controller.signal),
    ),
  );
  const ok: ChatAttachment[] = [];
  const cleanupPromises: Promise<void>[] = [];
  for (const [index, result] of uploaded.entries()) {
    const controller = pendingUploads[index]?.controller;
    if (result.status === "fulfilled") {
      if (controller?.signal.aborted) {
        cleanupPromises.push(deleteUploadedObject(result.value.key));
      } else {
        ok.push(result.value);
      }
      continue;
    }
    if (controller?.signal.aborted || isUploadCanceledError(result.reason)) {
      continue;
    }
    toast.error(
      result.reason instanceof Error ? result.reason.message : "Upload failed",
    );
  }
  if (cleanupPromises.length > 0) {
    await Promise.all(cleanupPromises);
  }
  if (ok.length > 0) {
    onAttachmentsChange((current) => [...current, ...ok]);
  }
}

function ComposerAttachmentList({
  attachments,
  pendingAttachments,
  onPreview,
  onRemove,
  onCancel,
}: {
  attachments: ChatAttachment[];
  pendingAttachments: PendingAttachment[];
  onPreview: (attachment: ChatAttachment) => void;
  onRemove: (key: string) => void;
  onCancel: (id: string) => void;
}) {
  if (attachments.length === 0 && pendingAttachments.length === 0) return null;
  return (
    <ul
      aria-label="Attached files"
      className="mb-2 flex list-none flex-wrap gap-x-2 gap-y-2 p-0"
    >
      {attachments.map((attachment) => (
        <li key={attachment.key}>
          <AttachmentThumbnail
            attachment={attachment}
            onPreview={() => onPreview(attachment)}
            onRemove={() => onRemove(attachment.key)}
          />
        </li>
      ))}
      {pendingAttachments.map((attachment) => (
        <li key={attachment.id}>
          <AttachmentThumbnail
            attachment={attachment}
            isUploading
            onCancel={() => onCancel(attachment.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function ComposerSendButton({
  isGenerating,
  isStopping,
  canSend,
  onStop,
}: {
  isGenerating: boolean;
  isStopping: boolean;
  canSend: boolean;
  onStop?: () => void;
}) {
  return (
    <button
      type={isGenerating ? "button" : "submit"}
      aria-label={isGenerating ? "Stop generation" : "Send message"}
      onClick={isGenerating ? onStop : undefined}
      disabled={isGenerating ? isStopping : !canSend}
      className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-white transition-[background-color,transform] duration-100 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-95 disabled:bg-[#c9cae4] disabled:text-white/80"
    >
      {isGenerating ? (
        <Square aria-hidden="true" className="size-3.5" fill="currentColor" strokeWidth={1.5} />
      ) : (
        <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.4} />
      )}
    </button>
  );
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

    const knownFingerprints = new Set([
      ...attachments.map(attachmentFingerprint),
      ...pendingAttachments.map(attachmentFingerprint),
    ]);
    const acceptedFiles = collectAcceptedFiles(files, knownFingerprints);
    if (acceptedFiles.length === 0) return;

    const pendingUploads = acceptedFiles.map(toPendingUpload);
    const pending = pendingUploads.map(({ id, file, controller }) => ({
      id,
      controller,
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      size: file.size,
    }));
    const pendingIds = new Set(pending.map((attachment) => attachment.id));
    setPendingAttachments((current) => [...current, ...pending]);
    try {
      await uploadAcceptedFiles(pendingUploads, onAttachmentsChange);
    } finally {
      setPendingAttachments((current) =>
        current.filter((attachment) => !pendingIds.has(attachment.id)),
      );
    }
  }

  function cancelPendingAttachment(id: string) {
    const attachment = pendingAttachments.find((item) => item.id === id);
    if (!attachment) return;
    attachment.controller.abort(new UploadCanceledError());
    setPendingAttachments((current) => current.filter((item) => item.id !== id));
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
      <div className="flex min-h-28.5 flex-col rounded-[11px] border border-border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.035)] transition-[border-color,box-shadow] focus-within:border-[#d9dae0] focus-within:shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <ComposerAttachmentList
          attachments={attachments}
          pendingAttachments={pendingAttachments}
          onPreview={setPreviewAttachment}
          onRemove={(key) =>
            onAttachmentsChange?.((current) =>
              current.filter((candidate) => candidate.key !== key),
            )
          }
          onCancel={cancelPendingAttachment}
        />
        <textarea
          ref={textareaRef}
          aria-label="Message the assistant"
          placeholder="Ask me anything..."
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          className="min-h-15 w-full shrink-0 resize-none bg-transparent text-[15px] leading-6 text-[#25262b] outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-auto flex h-6 shrink-0 items-center justify-between">
          {onAttachmentsChange ? (
            <button
              type="button"
              aria-label="Attach a file"
              onClick={selectFiles}
              disabled={isSubmitting || loading}
              className="inline-flex size-7 items-center justify-center rounded-full text-[#71747c] transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-50"
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
          <ComposerSendButton
            isGenerating={isGenerating}
            isStopping={isStopping}
            canSend={canSend}
            onStop={onStop}
          />
        </div>
      </div>
    </form>
    <PreviewModal
      storageKey={previewAttachment?.key ?? null}
      filename={previewAttachment?.name ?? ""}
      mediaType={previewAttachment?.mediaType}
      onClose={() => setPreviewAttachment(null)}
    />
    </>
  );
}
