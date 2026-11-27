"use client";

import { StickToBottom } from "use-stick-to-bottom";
import { Reasoning } from "@/components/agent/reasoning";
import { UserPromptBubble } from "@/components/agent/thread-message-parts";
import type { PreviewAttachment } from "@/lib/file-preview-types";
import type { OptimisticFirstMessage } from "./optimistic-first-message-types";

export type { OptimisticFirstMessage } from "./optimistic-first-message-types";

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
          scrollClassName="overflow-y-auto px-6 pt-6 pb-14"
          className="mx-auto flex min-h-full w-full max-w-178 flex-col gap-6"
        >
          <div className="flex w-full flex-col gap-4 items-end">
            <UserPromptBubble
              text={message.prompt}
              attachments={message.attachments}
              onPreview={onPreview}
            />
            <div className="w-full self-start">
              <Reasoning parts={[]} isStreaming startedAt={message.createdAt} />
            </div>
          </div>
        </StickToBottom.Content>
      </StickToBottom>
    </div>
  );
}
