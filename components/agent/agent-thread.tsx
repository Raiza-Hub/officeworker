"use client";

import { StickToBottom } from "use-stick-to-bottom";
import { useEditMessage } from "@/store/edit-message";
import { ThreadSubmissionCard } from "@/components/agent/thread-submission-card";
import type { OptimisticFirstMessage } from "@/components/agent/optimistic-first-message-types";
import type { PreviewAttachment } from "@/lib/file-preview-types";
import type {
  CachedThreadResult,
  ThreadMessageView,
  ThreadMessages,
  TurnTimingMap,
} from "@/hooks/use-agent-thread-state";
import { ThreadMessageRow } from "./agent-thread-rows";
import {
  useOptimisticResolution,
  useThreadConnection,
  useThreadLoadMore,
} from "@/hooks/use-agent-thread-state";
import { ThreadLoading } from "./thread-loading";

export function AgentThread({
  threadId,
  optimisticFirstMessage,
  cachedThread,
  messages,
  realResults,
  visibleResults,
  timingByPromptId,
  resultsByOrder,
  userOrders,
  onOptimisticResolved,
  onPreview,
}: {
  threadId: string;
  optimisticFirstMessage?: OptimisticFirstMessage | null;
  cachedThread: CachedThreadResult;
  messages: ThreadMessages;
  realResults: ThreadMessageView[];
  visibleResults: ThreadMessageView[];
  timingByPromptId: TurnTimingMap;
  resultsByOrder: Map<number, ThreadMessageView>;
  userOrders: Set<number>;
  onOptimisticResolved?: () => void;
  onPreview: (attachment: PreviewAttachment) => void;
}) {
  const { isReconnecting, connectionRetries } = useThreadConnection();
  const { editing, startEdit } = useEditMessage();

  useOptimisticResolution(optimisticFirstMessage, realResults, onOptimisticResolved);

  const lastMessage = visibleResults[visibleResults.length - 1];
  const isLoadingConversation =
    messages.status === "LoadingFirstPage" &&
    cachedThread.isLoading &&
    visibleResults.length === 0 &&
    !optimisticFirstMessage;

  useThreadLoadMore(messages);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickToBottom className="min-h-0 flex-1" resize="smooth" initial="instant">
        <StickToBottom.Content
          scrollClassName="overflow-y-auto px-6 pt-6 pb-14"
          className="mx-auto flex min-h-full w-full max-w-178 flex-col gap-6"
        >
          {visibleResults.map((message) => (
            <ThreadMessageRow
              key={message.id}
              message={message}
              userOrders={userOrders}
              resultsByOrder={resultsByOrder}
              timingByPromptId={timingByPromptId}
              editing={editing}
              startEdit={startEdit}
              onPreview={onPreview}
              lastMessageId={lastMessage?.id}
              isReconnecting={isReconnecting}
              connectionRetries={connectionRetries}
            />
          ))}
          {isLoadingConversation ? (
            <ThreadLoading />
          ) : (
            <ThreadSubmissionCard threadId={threadId} />
          )}
        </StickToBottom.Content>
      </StickToBottom>
    </div>
  );
}
