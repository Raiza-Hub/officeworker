"use client";

import { StickToBottom } from "use-stick-to-bottom";
import { Reasoning } from "@/components/agent/reasoning";
import { UserAttachments, type PreviewAttachment } from "@/components/agent/thread-message-parts";
import type { ChatAttachment } from "@/lib/attachments";

export type OptimisticFirstMessage = {
  tempId: string;
  messageId?: string;
  prompt: string;
  attachments: ChatAttachment[];
  createdAt: number;
};

export function OptimisticFirstMessageView({
  message,
  onPreview,
}: {
  message: OptimisticFirstMessage;
  onPreview: (attachment: PreviewAttachment) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickToBottom className="min-h-0 flex-1" resize="smooth" initial="instant">
        <StickToBottom.Content
          scrollClassName="overflow-y-auto px-6 py-6"
          className="mx-auto flex min-h-full w-full max-w-178 flex-col gap-6"
        >
          <div className="flex w-full flex-col gap-4 items-end">
            <div className="max-w-[80%] rounded-[14px] rounded-br-sm bg-primary px-3.5 py-2.5 text-sm leading-5.5 text-white">
              <p className="m-0 whitespace-pre-wrap">{message.prompt}</p>
              <UserAttachments attachments={message.attachments} onPreview={onPreview} />
            </div>
            <div className="w-full self-start">
              <Reasoning parts={[]} isStreaming startedAt={message.createdAt} />
            </div>
          </div>
        </StickToBottom.Content>
      </StickToBottom>
    </div>
  );
}
