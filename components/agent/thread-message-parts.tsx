"use client";

import { useSmoothText } from "@convex-dev/agent/react";
import { AlertTriangle } from "lucide-react";
import { AttachmentThumbnail } from "@/components/agent/attachment-thumbnail";
import { type UIMessagePartList } from "@/components/agent/parts";
import { buildEntries } from "./thread-helpers";
import type { PreviewAttachment } from "@/lib/file-preview-types";

type Attachment = PreviewAttachment;

export function TextPart({ text }: { text: string }) {
  const [smoothText] = useSmoothText(text);
  const cleanText = smoothText.replace(/\[submission:[^\]]*\]?/g, "").trimEnd();
  if (!cleanText) return null;
  return (
    <p className="m-0 max-w-none whitespace-pre-wrap text-sm leading-5.5 text-ink">
      {cleanText}
    </p>
  );
}

export function AssistantMessage({
  parts,
  status,
  isStreaming,
  cancelled = false,
}: {
  parts: UIMessagePartList;
  status: string;
  isStreaming: boolean;
  cancelled?: boolean;
}) {
  const entries = buildEntries(parts);
  if (status === "failed" && !cancelled) {
    return (
      <div className="flex items-center gap-1.5 text-xs leading-none text-muted-foreground">
        <AlertTriangle
          aria-hidden="true"
          className="size-3.5 shrink-0 text-[#d64545]"
          strokeWidth={2}
        />
        <span>Something went wrong generating a reply.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <TextPart key={entry.key} text={entry.text} />
      ))}
      {isStreaming && entries.length === 0 && (
        <span className="sr-only">Thinking</span>
      )}
    </div>
  );
}

export function UserAttachments({
  attachments,
  onPreview,
  className = "",
}: {
  attachments: Attachment[];
  onPreview: (attachment: Attachment) => void;
  className?: string;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className={`flex flex-wrap justify-end gap-x-2 gap-y-2 ${className}`.trim()}>
      {attachments.map((attachment) => (
        <AttachmentThumbnail
          key={attachment.key}
          attachment={attachment}
          onPreview={() => onPreview(attachment)}
          showName={false}
        />
      ))}
    </div>
  );
}

export function UserPromptBubble({
  text,
  attachments,
  onPreview,
}: {
  text: string;
  attachments: Attachment[];
  onPreview: (attachment: Attachment) => void;
}) {
  const hasText = text.trim().length > 0;
  if (!hasText && attachments.length === 0) return null;
  return (
    <div className="flex max-w-[80%] flex-col items-end gap-2">
      <UserAttachments attachments={attachments} onPreview={onPreview} />
      {hasText && (
        <div className="rounded-xl bg-user-prompt-bg px-3.5 py-2.5 text-sm leading-5.5 text-ink">
          <p className="m-0 whitespace-pre-wrap break-words">{text}</p>
        </div>
      )}
    </div>
  );
}
