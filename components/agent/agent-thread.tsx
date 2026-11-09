"use client";

import { useUIMessages, useSmoothText } from "@convex-dev/agent/react";
import { useQuery } from "convex-helpers/react/cache";
import { useConvexConnectionState } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useMessagesStatus,
  useThreadTitle,
} from "@/components/agent/thread-contexts";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileImage,
  FileSpreadsheet,
  Loader,
  MessageSquareText,
} from "lucide-react";
import { StickToBottom } from "use-stick-to-bottom";
import { SubmissionCard } from "@/components/agent/submission-card";
import { Reasoning } from "@/components/agent/reasoning";
import { useElapsed } from "@/components/agent/activity-row";
import { ShimmerText } from "@/components/agent/shimmer";
import { PreviewModal } from "@/components/agent/preview-modal";
import { prefetchAttachmentPreview } from "@/components/agent/preview-url-cache";
import {
  isToolPart,
  partText,
  type UIMessagePartList,
} from "@/components/agent/parts";
import {
  usePendingReply,
} from "@/components/agent/pending-reply-context";
import {
  useCachedThreadMessages,
  type CachedThreadMessage,
} from "@/components/agent/thread-history-cache";

type Attachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

type ThreadMessageView = CachedThreadMessage;

function historyMessageKey(message: {
  id: string;
  role?: string;
  order?: number;
  stepOrder?: number;
}) {
  if (message.role === "user" && message.order !== undefined) {
    return `user:${message.order}`;
  }
  return message.role === "assistant" && message.order !== undefined
    ? `assistant:${message.order}:${message.stepOrder ?? 0}`
    : `${message.role ?? "message"}:${message.id}`;
}

function finalAssistantParts(parts: UIMessagePartList): UIMessagePartList {
  const lastToolIndex = parts.reduce(
    (lastIndex, part, index) => (isToolPart(part) ? index : lastIndex),
    -1,
  );
  return lastToolIndex < 0 ? parts : parts.slice(lastToolIndex + 1);
}

function TextPart({ text }: { text: string }) {
  const [smoothText] = useSmoothText(text);
  // Marker text streams in raw; strip it for display.
  const cleanText = smoothText.replace(/\[submission:[^\]]*\]?/g, "").trimEnd();
  if (!cleanText) return null;

  return (
    <p className="m-0 max-w-none whitespace-pre-wrap text-[14px] leading-[22px] text-[#24252a]">
      {cleanText}
    </p>
  );
}

export function LiveLine({
  startedAt,
  showElapsed = true,
}: {
  startedAt: number;
  showElapsed?: boolean;
}) {
  const elapsed = useElapsed(startedAt, showElapsed);
  return (
    <div className="flex items-center gap-1.5 text-[12px] leading-none">
      <Loader
        aria-hidden="true"
        className="size-3.5 animate-spin text-[#85878e] [animation-duration:0.7s]"
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

type Entry =
  | { key: string; kind: "text"; text: string };

function buildEntries(parts: UIMessagePartList): Entry[] {
  const entries: Entry[] = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    if (part.type === "text") {
      const text = partText(part);
      if (text) entries.push({ key: `text-${i}`, kind: "text", text });
      i += 1;
      continue;
    }
    if (part.type === "reasoning") {
      i += 1;
      continue;
    }
    i += 1;
  }
  return entries;
}

function AssistantMessage({
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
      {entries.map((entry) => {
        return <TextPart key={entry.key} text={entry.text} />;
      })}
      {isStreaming && entries.length === 0 && (
        <span className="sr-only">Thinking</span>
      )}
    </div>
  );
}

function AttachmentChip({
  attachment,
  onPreview,
}: {
  attachment: Attachment;
  onPreview: (attachment: Attachment) => void;
}) {
  const isImage = attachment.mediaType.startsWith("image/");
  const isSheet =
    attachment.mediaType.includes("sheet") ||
    attachment.mediaType.includes("csv") ||
    /\.(xlsx|xls|csv)$/i.test(attachment.name);
  const Icon = isImage ? FileImage : isSheet ? FileSpreadsheet : MessageSquareText;

  return (
    <button
      type="button"
      onClick={() => onPreview(attachment)}
      onPointerEnter={() => prefetchAttachmentPreview(attachment)}
      onFocus={() => prefetchAttachmentPreview(attachment)}
      aria-label={`Preview ${attachment.name}`}
      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] leading-none font-[450] text-white transition-colors hover:bg-white/25"
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate">{attachment.name}</span>
    </button>
  );
}

function UserAttachments({
  attachments,
  onPreview,
}: {
  attachments: Attachment[];
  onPreview: (attachment: Attachment) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {attachments.map((attachment) => (
        <AttachmentChip
          key={attachment.key}
          attachment={attachment}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

function extractSubmissionIds(parts: UIMessagePartList): string[] {
  const text = parts.map(partText).join("");
  const ids: string[] = [];
  for (const match of text.matchAll(/\[submission:([a-z0-9]+)\]/gi)) {
    if (match[1]) ids.push(match[1]);
  }
  return [...new Set(ids)];
}

export function ThreadLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start px-6 pt-6">
      <p
        role="status"
        className="mx-auto mt-0 mb-0 flex w-full max-w-[712px] items-center justify-start gap-1.5 text-left text-[13px] text-[#85878e]"
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
}: {
  threadId: string;
}) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
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
    setTitle(summary?.title ?? null);
  }, [summary?.title, setTitle]);
  const { pending, clearPending, navigation } = usePendingReply();
  const threadPending = pending?.threadId === threadId ? pending : null;
  const showInitialLoading =
    navigation?.threadId === threadId
      ? navigation.source === "activity"
      : !threadPending;

  const results = useMemo(() => {
    const byKey = new Map<string, ThreadMessageView>();
    for (const message of cachedThread.messages) {
      byKey.set(historyMessageKey(message), message as ThreadMessageView);
    }
    for (const message of messages.results ?? []) {
      byKey.set(historyMessageKey(message), message as ThreadMessageView);
    }
    return [...byKey.values()].sort((a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER) ||
      (a.stepOrder ?? 0) - (b.stepOrder ?? 0),
    );
  }, [cachedThread.messages, messages.results]);
  const lastMessage = results[results.length - 1];

  useEffect(() => {
    setStatus(
      messages.status === "LoadingFirstPage" && !cachedThread.isLoading
        ? "Exhausted"
        : messages.status,
    );
  }, [cachedThread.isLoading, messages.status, setStatus]);

  useEffect(() => {
    if (!threadPending || !cacheScope) return;
    const userLanded = results.some((message) => message.id === threadPending.messageId);
    if (userLanded) clearPending();
  }, [cacheScope, threadPending, results, clearPending]);

  useEffect(() => {
    if (messages.status === "CanLoadMore") messages.loadMore(30);
  }, [messages]);

  const timingByPromptId = useMemo(
    () => new Map((turnTimings ?? []).map((turn) => [turn.promptMessageId, turn])),
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
    if (message.role !== "user" || typeof message.order !== "number") {
      continue;
    }
    const assistant = results.find(
      (candidate) =>
        candidate.role === "assistant" && candidate.order === message.order,
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

  const displayedResults = [...results];
  if (
    threadPending &&
    !displayedResults.some((message) => message.id === threadPending.messageId)
  ) {
    displayedResults.push({
      id: threadPending.messageId,
      key: threadPending.messageId,
      role: "user",
      text: threadPending.prompt,
      parts: [{ type: "text", text: threadPending.prompt }],
      order: Number.MAX_SAFE_INTEGER,
      stepOrder: 0,
      status: "pending",
      _creationTime: 0,
      attachments: threadPending.attachments,
    });
  }
  const userOrders = new Set(
    displayedResults
      .filter((message) => message.role === "user")
      .map((message) => message.order)
      .filter((order): order is number => typeof order === "number"),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickToBottom className="min-h-0 flex-1" resize="smooth" initial="instant">
        <StickToBottom.Content
          scrollClassName="overflow-y-auto px-6 py-6"
          className="mx-auto flex min-h-full w-full max-w-[712px] flex-col gap-6"
        >
          {displayedResults.map((message) => {
            const isUser = message.role === "user";
            if (
              !isUser &&
              typeof message.order === "number" &&
              userOrders.has(message.order)
            ) {
              return null;
            }
            const parts = (message.parts ?? []) as UIMessagePartList;
            const submissionIds = isUser ? [] : extractSubmissionIds(parts);
            const attachments = Array.isArray(
              (message as { attachments?: unknown }).attachments,
            )
              ? ((message as { attachments?: Attachment[] }).attachments ??
                [])
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
              typeof message.order === "number"
                ? resultsByOrder.get(message.order)
                : undefined;
            const assistantParts = (assistant?.parts ?? []) as UIMessagePartList;
            const timing = timingByPromptId.get(message.id);
            const isPendingTurn =
              message.id === threadPending?.messageId ||
              (!assistant && message.id === lastMessage?.id);
            const isStreaming =
              assistant?.status === "streaming" ||
              timing?.status === "running" ||
              Boolean(isPendingTurn);
            return (
              <div key={message.id} className="flex w-full flex-col gap-4 items-end">
                <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[#626bd9] px-3.5 py-2.5 text-[14px] leading-[22px] text-white">
                  <p className="m-0 whitespace-pre-wrap">
                    {parts.map(partText).join("")}
                  </p>
                  <UserAttachments
                    attachments={attachments}
                    onPreview={setPreviewAttachment}
                  />
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
          {messages.status === "LoadingFirstPage" && cachedThread.isLoading &&
            !threadPending && showInitialLoading && results.length === 0 && <ThreadLoading />}
        </StickToBottom.Content>
      </StickToBottom>
      {previewAttachment && (
        <PreviewModal
          storageKey={previewAttachment.key}
          filename={previewAttachment.name}
          mediaType={previewAttachment.mediaType}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
