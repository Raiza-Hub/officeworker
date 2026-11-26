"use client";

import { useUIMessages } from "@convex-dev/agent/react";
import { useQuery } from "convex-helpers/react/cache";
import { useConvexConnectionState } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type {
  ActiveTurn,
  EditingMessage,
} from "@/store/edit-message";
import type {
  OptimisticFirstMessage,
} from "@/components/agent/optimistic-first-message-types";
import {
  useCachedThreadMessages,
  type CachedThreadMessage,
} from "@/hooks/use-cached-thread-messages";
import {
  historyMessageKey,
  visibleThreadResults,
} from "@/components/agent/thread-helpers";

export type ThreadMessageView = CachedThreadMessage;
export type ThreadMessages = ReturnType<
  typeof useUIMessages<typeof api.chat.listThreadMessages>
>;
export type CachedThreadResult = ReturnType<typeof useCachedThreadMessages>;

export type ThreadTiming = {
  promptMessageId: string;
  status?: string | null;
  startedAt?: number;
  durationMs?: number;
};

export type TurnStatus = Pick<ThreadTiming, "status">;
export type TurnTimingMap = Map<string, ThreadTiming>;

export function useThreadConnection() {
  const connectionState = useConvexConnectionState();
  const isReconnecting =
    connectionState.hasEverConnected && !connectionState.isWebSocketConnected;
  return {
    isReconnecting,
    connectionRetries: connectionState.connectionRetries,
  };
}

export function useThreadScope(threadId: string | null) {
  const viewer = useQuery(api.users.current, {});
  const cacheScope = viewer?._id;
  const summary = useQuery(
    api.chat.getThreadSummary,
    threadId && cacheScope ? { threadId, cacheScope } : "skip",
  );
  return { cacheScope, summary };
}

type ThreadSummary = ReturnType<typeof useThreadScope>["summary"];
type CacheScope = ReturnType<typeof useThreadScope>["cacheScope"];

export function useThreadQueries(threadId: string | null, cacheScope: CacheScope) {
  const cachedThread = useCachedThreadMessages({
    threadId: threadId ?? "",
    cacheScope: threadId ? cacheScope : undefined,
  });
  const turnTimings = useQuery(
    api.chat.listThreadTurnTimings,
    threadId && cacheScope ? { threadId, cacheScope } : "skip",
  );
  const messages = useUIMessages(
    api.chat.listThreadMessages,
    threadId && cacheScope ? { threadId, cacheScope } : "skip",
    { initialNumItems: 30, stream: true },
  );
  return { cachedThread, turnTimings, messages };
}

export function getThreadTitle(summary: ThreadSummary, hasThread: boolean) {
  if (!hasThread) return null;
  if (summary === undefined) return undefined;
  return summary.title || null;
}

export function useThreadResults(
  cachedThread: { messages: ThreadMessageView[] },
  messages: Pick<ThreadMessages, "results">,
  optimisticFirstMessage?: OptimisticFirstMessage | null,
) {
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

  return { realResults, results };
}

export function useVisibleResults(
  results: ThreadMessageView[],
  editing: EditingMessage | null,
) {
  return useMemo(() => visibleThreadResults(results, editing), [editing, results]);
}

export function useOptimisticResolution(
  optimisticFirstMessage: OptimisticFirstMessage | null | undefined,
  realResults: ThreadMessageView[],
  onOptimisticResolved?: () => void,
) {
  useEffect(() => {
    if (!optimisticFirstMessage?.messageId) return;
    if (realResults.some((message) => message.id === optimisticFirstMessage.messageId)) {
      onOptimisticResolved?.();
    }
  }, [onOptimisticResolved, optimisticFirstMessage, realResults]);
}

export function getMessagesStatus(
  messages: Pick<ThreadMessages, "status">,
  cachedThread: { isLoading: boolean },
  hasThread: boolean,
) {
  if (!hasThread) return "Ready";
  return messages.status === "LoadingFirstPage" && !cachedThread.isLoading
    ? "Exhausted"
    : messages.status;
}

export function useThreadLoadMore(messages: ThreadMessages) {
  const { status, loadMore } = messages;
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(30);
  }, [loadMore, status]);
}

export function useTurnTimingMap<T extends ThreadTiming>(
  turnTimings: T[] | undefined,
) {
  return useMemo(
    () =>
      new Map<string, T>(
        (turnTimings ?? []).map((turn) => [turn.promptMessageId, turn]),
      ),
    [turnTimings],
  );
}

export function getResultsByOrder(results: ThreadMessageView[]) {
  const resultsByOrder = new Map<number, ThreadMessageView>();
  for (const message of results) {
    if (message.role === "assistant" && typeof message.order === "number") {
      resultsByOrder.set(message.order, message);
    }
  }
  return resultsByOrder;
}

export function getUserOrders(results: ThreadMessageView[]) {
  return new Set(
    results
      .filter((message) => message.role === "user")
      .map((message) => message.order)
      .filter((order): order is number => typeof order === "number"),
  );
}

export function findActiveTurn(
  visibleResults: ThreadMessageView[],
  timingByPromptId: ReadonlyMap<string, TurnStatus>,
): ActiveTurn | null {
  for (let index = visibleResults.length - 1; index >= 0; index -= 1) {
    const message = visibleResults[index];
    if (message.role !== "user" || typeof message.order !== "number") continue;
    const assistant = visibleResults.find(
      (candidate) => candidate.role === "assistant" && candidate.order === message.order,
    );
    const timing = timingByPromptId.get(message.id);
    if (timing?.status === "running" || assistant?.status === "streaming") {
      return { promptMessageId: message.id, order: message.order };
    }
  }
  return null;
}
