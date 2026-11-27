"use client";

import type { ComponentProps, ReactNode } from "react";
import { AgentThread } from "@/components/agent/agent-thread";
import type {
  OptimisticFirstMessage,
} from "@/components/agent/optimistic-first-message-types";
import { OptimisticFirstMessageView } from "@/components/agent/optimistic-first-message";
import type { PreviewAttachment } from "@/lib/file-preview-types";

type AgentThreadData = Omit<
  ComponentProps<typeof AgentThread>,
  "threadId" | "onOptimisticResolved" | "onPreview"
>;

type AgentChatConversationProps = AgentThreadData & {
  effectiveThreadId: string | null;
  optimisticFirstMessage: OptimisticFirstMessage | null;
  onOptimisticResolved: () => void;
  onPreview: (attachment: PreviewAttachment) => void;
  notice: ReactNode;
  composer: ReactNode;
};

export function AgentChatConversation({
  effectiveThreadId,
  optimisticFirstMessage,
  onOptimisticResolved,
  onPreview,
  notice,
  composer,
  ...threadData
}: AgentChatConversationProps) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {effectiveThreadId ? (
          <AgentThread
            threadId={effectiveThreadId}
            {...threadData}
            optimisticFirstMessage={optimisticFirstMessage}
            onOptimisticResolved={onOptimisticResolved}
            onPreview={onPreview}
          />
        ) : optimisticFirstMessage ? (
          <OptimisticFirstMessageView
            message={optimisticFirstMessage}
            onPreview={onPreview}
          />
        ) : null}
      </div>
      <div className="shrink-0 px-6 pb-5">
        <div className="relative mx-auto w-full max-w-178">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-10 z-10 h-10"
            style={{
              background:
                "linear-gradient(to top, var(--color-agent-page-bg) 0%, rgba(249, 249, 250, 0.75) 45%, rgba(249, 249, 250, 0) 100%)",
            }}
          />
          {notice}
          {composer}
        </div>
      </div>
    </>
  );
}
