"use client";

import { useSmoothText } from "@convex-dev/agent/react";
import { AlertTriangle } from "lucide-react";
import { SubmissionCard } from "@/components/agent/submission-card";
import { AttachmentThumbnail } from "@/components/agent/attachment-thumbnail";
import { type UIMessagePartList } from "@/components/agent/parts";
import { buildEntries, extractSubmissionIds } from "./thread-helpers";

type Attachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

export function TextPart({ text }: { text: string }) {
  const [smoothText] = useSmoothText(text);
  const cleanText = smoothText.replace(/\[submission:[^\]]*\]?/g, "").trimEnd();
  if (!cleanText) return null;
  return (
    <p className="m-0 max-w-none whitespace-pre-wrap text-[14px] leading-[22px] text-[#24252a]">
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
      <div className="flex items-center gap-1.5 text-[12px] leading-none text-[#85878e]">
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
}: {
  attachments: Attachment[];
  onPreview: (attachment: Attachment) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-2">
      {attachments.map((attachment) => (
        <AttachmentThumbnail
          key={attachment.key}
          attachment={attachment}
          onPreview={() => onPreview(attachment)}
          inverse
        />
      ))}
    </div>
  );
}

export function SubmissionCards({ parts }: { parts: UIMessagePartList }) {
  return (
    <>
      {extractSubmissionIds(parts).map((id) => (
        <div key={id} className="w-full">
          <SubmissionCard submissionId={id} />
        </div>
      ))}
    </>
  );
}
