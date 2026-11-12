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
  uploadChatAttachment,
  type ChatAttachment,
} from "@/lib/attachments";
import { BLOCKED_MEDIA_MESSAGE, isBlockedMediaFile } from "@/lib/blocked-media";
import { AttachmentThumbnail } from "@/components/agent/attachment-thumbnail";
import { PreviewModal } from "@/components/agent/preview-modal";

const MIN_TEXTAREA_HEIGHT = 54;
const MAX_COMPOSER_HEIGHT = 240;

type PendingAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
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

function toPendingAttachment(file: File): PendingAttachment {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mediaType: file.type || "application/octet-stream",
    size: file.size,
  };
}

async function uploadAcceptedFiles(
  acceptedFiles: File[],
  onAttachmentsChange: Dispatch<SetStateAction<ChatAttachment[]>>,
) {
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
        result.reason instanceof Error ? result.reason.message : "Upload failed",
      );
    }
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
}: {
  attachments: ChatAttachment[];
  pendingAttachments: PendingAttachment[];
  onPreview: (attachment: ChatAttachment) => void;
  onRemove: (key: string) => void;
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
          <AttachmentThumbnail attachment={attachment} isUploading />
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
      className="inline-flex size-7 items-center justify-center rounded-full bg-[#626bd9] text-white transition-[background-color,transform] duration-100 hover:bg-[#555fc9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2 active:scale-95 disabled:bg-[#c9cae4] disabled:text-white/80"
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

    const pending = acceptedFiles.map(toPendingAttachment);
    const pendingIds = new Set(pending.map((attachment) => attachment.id));
    setPendingAttachments((current) => [...current, ...pending]);
    try {
      await uploadAcceptedFiles(acceptedFiles, onAttachmentsChange);
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
        <ComposerAttachmentList
          attachments={attachments}
          pendingAttachments={pendingAttachments}
          onPreview={setPreviewAttachment}
          onRemove={(key) =>
            onAttachmentsChange?.((current) =>
              current.filter((candidate) => candidate.key !== key),
            )
          }
        />
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
