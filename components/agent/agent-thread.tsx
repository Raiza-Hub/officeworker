"use client";

import { useUIMessages } from "@convex-dev/agent/react";
import { useQuery } from "convex-helpers/react/cache";
import { useConvexConnectionState } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMessagesStatus, useThreadTitle } from "@/components/agent/thread-contexts";
import { useEffect, useMemo } from "react";
import { Loader } from "lucide-react";
import { StickToBottom } from "use-stick-to-bottom";
import { SubmissionCard } from "@/components/agent/submission-card";
import { Reasoning } from "@/components/agent/reasoning";
import { useElapsed } from "@/components/agent/activity-row";
import { ShimmerText } from "@/components/agent/shimmer";
import { partText, type UIMessagePartList } from "@/components/agent/parts";
import {
  useCachedThreadMessages,
  type CachedThreadMessage,
} from "@/components/agent/thread-history-cache";
import { type OptimisticFirstMessage } from "@/components/agent/optimistic-first-message";
import { extractSubmissionIds, finalAssistantParts, historyMessageKey } from "./thread-helpers";
import {
  AssistantMessage,
  UserAttachments,
  type PreviewAttachment,
} from "./thread-message-parts";

type ThreadMessageView = CachedThreadMessage;

export function LiveLine({
  startedAt,
  showElapsed = true,
}: {
  startedAt: number;
  showElapsed?: boolean;
}) {
  const elapsed = useElapsed(startedAt, showElapsed);
  return (
    <div className="flex items-center gap-1.5 text-xs leading-none">
      <Loader
        aria-hidden="true"
        className="size-3.5 animate-spin text-muted-foreground [animation-duration:0.7s]"
        strokeWidth={2}
      />
      <ShimmerText>Thinking…</ShimmerText>
      {showElapsed && (
        <span className="pl-1 font-mono text-[11px] tabular-nums text-[#b3b5bc]">
          {elapsed}
        </span>
      )}
    </div>
  );
}

export function ThreadLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start px-6 pt-6">
      <p
        role="status"
        className="mx-auto mt-0 mb-0 flex w-full max-w-178 items-center justify-start gap-1.5 text-left text-[13px] text-muted-foreground"
      >
        <Loader
          aria-hidden="true"
          className="size-3.5 animate-spin [animation-duration:0.7s]"
          strokeWidth={2}
        />
        Loading conversation…
      </p>
    </div>
  );
}

export function AgentThread({
  threadId,
  optimisticFirstMessage,
  onOptimisticResolved,
  onPreview,
}: {
  threadId: string;
  optimisticFirstMessage?: OptimisticFirstMessage | null;
  onOptimisticResolved?: () => void;
  onPreview: (attachment: PreviewAttachment) => void;
}) {
  const connectionState = useConvexConnectionState();
  const isReconnecting =
    connectionState.hasEverConnected && !connectionState.isWebSocketConnected;
  const viewer = useQuery(api.users.current, {});
  const cacheScope = viewer?._id;
  const summary = useQuery(
    api.chat.getThreadSummary,
    cacheScope ? { threadId, cacheScope } : "skip",
  );
  const { setTitle } = useThreadTitle();
  const { setStatus, setActiveTurn } = useMessagesStatus();
  const cachedThread = useCachedThreadMessages({ threadId, cacheScope });
  const turnTimings = useQuery(
    api.chat.listThreadTurnTimings,
    cacheScope ? { threadId, cacheScope } : "skip",
  );
  const messages = useUIMessages(
    api.chat.listThreadMessages,
    cacheScope ? { threadId, cacheScope } : "skip",
    { initialNumItems: 30, stream: true },
  );

  useEffect(() => {
    if (summary === undefined) return;
    setTitle(summary.title ?? null);
  }, [summary, setTitle]);

  const realResults = useMemo(() => {
    const byKey = new Map<string, ThreadMessageView>();
    for (const message of cachedThread.messages) {
      byKey.set(historyMessageKey(message), message as ThreadMessageView);
    }
    for (const message of messages.results ?? []) {
      byKey.set(historyMessageKey(message), message as ThreadMessageView);
    }
    return [...byKey.values()].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        (a.stepOrder ?? 0) - (b.stepOrder ?? 0),
    );
  }, [cachedThread.messages, messages.results]);

  const results = useMemo(() => {
    if (!optimisticFirstMessage) return realResults;
    if (
      optimisticFirstMessage.messageId &&
      realResults.some((message) => message.id === optimisticFirstMessage.messageId)
    ) {
      return realResults;
    }
    const optimisticView = {
      id: optimisticFirstMessage.messageId ?? optimisticFirstMessage.tempId,
      _creationTime: optimisticFirstMessage.createdAt,
      role: "user",
      status: "pending",
      text: optimisticFirstMessage.prompt,
      parts: optimisticFirstMessage.prompt
        ? [{ type: "text", text: optimisticFirstMessage.prompt, state: "done" }]
        : [],
      attachments: optimisticFirstMessage.attachments,
      key: `optimistic:${optimisticFirstMessage.tempId}`,
    } as ThreadMessageView;
    return [...realResults, optimisticView].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        (a.stepOrder ?? 0) - (b.stepOrder ?? 0),
    );
  }, [optimisticFirstMessage, realResults]);

  useEffect(() => {
    if (!optimisticFirstMessage?.messageId) return;
    if (realResults.some((message) => message.id === optimisticFirstMessage.messageId)) {
      onOptimisticResolved?.();
    }
  }, [onOptimisticResolved, optimisticFirstMessage, realResults]);

  const lastMessage = results[results.length - 1];

  useEffect(() => {
    setStatus(
      messages.status === "LoadingFirstPage" && !cachedThread.isLoading
        ? "Exhausted"
        : messages.status,
    );
  }, [cachedThread.isLoading, messages.status, setStatus]);

  useEffect(() => {
    if (messages.status === "CanLoadMore") messages.loadMore(30);
  }, [messages]);

  type TurnTiming = NonNullable<typeof turnTimings>[number];
  const timingByPromptId = useMemo(
    () => new Map<string, TurnTiming>((turnTimings ?? []).map((turn) => [turn.promptMessageId, turn as TurnTiming])),
    [turnTimings],
  );

  const resultsByOrder = new Map<number, (typeof results)[number]>();
  for (const message of results) {
    if (message.role === "assistant" && typeof message.order === "number") {
      resultsByOrder.set(message.order, message);
    }
  }

  let activeTurn: { promptMessageId: string; order: number } | null = null;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const message = results[index];
    if (message.role !== "user" || typeof message.order !== "number") continue;
    const assistant = results.find(
      (candidate) => candidate.role === "assistant" && candidate.order === message.order,
    );
    const timing = timingByPromptId.get(message.id);
    if (timing?.status === "running" || assistant?.status === "streaming") {
      activeTurn = { promptMessageId: message.id, order: message.order };
      break;
    }
  }

  const activePromptMessageId = activeTurn?.promptMessageId;
  const activeOrder = activeTurn?.order;
  useEffect(() => {
    setActiveTurn(
      activePromptMessageId !== undefined && activeOrder !== undefined
        ? { promptMessageId: activePromptMessageId, order: activeOrder }
        : null,
    );
  }, [activeOrder, activePromptMessageId, setActiveTurn]);

  const userOrders = new Set(
    results
      .filter((message) => message.role === "user")
      .map((message) => message.order)
      .filter((order): order is number => typeof order === "number"),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickToBottom className="min-h-0 flex-1" resize="smooth" initial="instant">
        <StickToBottom.Content
          scrollClassName="overflow-y-auto px-6 py-6"
          className="mx-auto flex min-h-full w-full max-w-178 flex-col gap-6"
        >
          {results.map((message) => {
            const isUser = message.role === "user";
            if (!isUser && typeof message.order === "number" && userOrders.has(message.order)) {
              return null;
            }
            const parts = (message.parts ?? []) as UIMessagePartList;
            const submissionIds = isUser ? [] : extractSubmissionIds(parts);
            const attachments = Array.isArray((message as { attachments?: unknown }).attachments)
              ? ((message as { attachments?: PreviewAttachment[] }).attachments ?? [])
              : [];

            if (!isUser) {
              return (
                <div key={message.id} className="flex w-full flex-col gap-2.5 items-start">
                  <div className="w-full">
                    <AssistantMessage
                      parts={parts}
                      status={message.status}
                      isStreaming={message.status === "streaming"}
                    />
                  </div>
                  {submissionIds.map((id) => (
                    <div key={id} className="w-full">
                      <SubmissionCard submissionId={id} />
                    </div>
                  ))}
                </div>
              );
            }

            const assistant =
              typeof message.order === "number" ? resultsByOrder.get(message.order) : undefined;
            const assistantParts = (assistant?.parts ?? []) as UIMessagePartList;
            const timing = timingByPromptId.get(message.id);
            const isStreaming =
              assistant?.status === "streaming" ||
              timing?.status === "running" ||
              message.status === "pending" ||
              (!assistant && message.id === lastMessage?.id);

            return (
              <div key={message.id} className="flex w-full flex-col gap-4 items-end">
                <div className="max-w-[80%] rounded-[14px] rounded-br-sm bg-primary px-3.5 py-2.5 text-sm leading-5.5 text-white">
                  <p className="m-0 whitespace-pre-wrap">{parts.map(partText).join("")}</p>
                  <UserAttachments attachments={attachments} onPreview={onPreview} />
                </div>
                <div className="w-full self-start" key={`turn:${message.id}`}>
                  <div className={assistant ? "mb-2.5" : ""}>
                    <Reasoning
                      parts={assistantParts}
                      isStreaming={isStreaming}
                      isResponseStreaming={assistant?.status === "streaming"}
                      startedAt={timing?.startedAt}
                      durationMs={timing?.durationMs}
                      cancelled={timing?.status === "cancelled"}
                      reconnecting={isReconnecting}
                      connectionRetries={connectionState.connectionRetries}
                    />
                  </div>
                  {assistant && (
                    <div className="flex flex-col gap-2.5 items-start">
                      <div className="w-full">
                        <AssistantMessage
                          parts={finalAssistantParts(assistantParts)}
                          status={assistant.status}
                          isStreaming={assistant.status === "streaming"}
                          cancelled={timing?.status === "cancelled"}
                        />
                      </div>
                      {extractSubmissionIds(assistantParts).map((id) => (
                        <div key={id} className="w-full">
                          <SubmissionCard submissionId={id} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {messages.status === "LoadingFirstPage" &&
            cachedThread.isLoading &&
            results.length === 0 &&
            !optimisticFirstMessage && <ThreadLoading />}
        </StickToBottom.Content>
      </StickToBottom>
    </div>
  );
}
