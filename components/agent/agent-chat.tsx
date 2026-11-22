"use client";

import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { AgentComposer } from "@/components/agent/agent-composer";
import { AgentThread } from "@/components/agent/agent-thread";
import {
  BillingNotice,
  billingNoticeForError,
  type BillingNoticeData,
} from "@/components/agent/billing-notice";
import { ComposerPrefillContext } from "@/components/agent/composer-context";
import {
  OptimisticFirstMessageView,
  type OptimisticFirstMessage,
} from "@/components/agent/optimistic-first-message";
import { PreviewModal } from "@/components/agent/preview-modal";
import {
  MessagesStatusContext,
  ThreadTitleContext,
} from "@/components/agent/thread-contexts";
import { type PreviewAttachment } from "@/components/agent/thread-message-parts";
import { type ChatAttachment } from "@/lib/attachments";
import { useChatStore, useEnsureDraft } from "@/lib/chat-store";

function messageFromError(error: unknown, fallback: string) {
  if (
    error instanceof ConvexError &&
    typeof (error.data as { message?: unknown })?.message === "string"
  ) {
    return (error.data as { message: string }).message;
  }
  return error instanceof Error ? error.message : fallback;
}

function createOptimisticTempId() {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `optimistic-${uuid}`;
}

export function AgentChat({ threadId: threadIdProp }: { threadId?: string }) {
  const isNewChat = threadIdProp === undefined;
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<BillingNoticeData | null>(null);
  const [messagesStatus, setMessagesStatus] = useState(
    isNewChat ? "Ready" : "LoadingFirstPage",
  );
  const [activeTurn, setActiveTurn] = useState<{
    promptMessageId: string;
    order: number;
  } | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [preloadedTitle, setPreloadedTitle] = useState<string | null | undefined>(
    isNewChat ? null : undefined,
  );
  const [clientThreadId, setClientThreadId] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(!isNewChat);
  const [optimisticFirstMessage, setOptimisticFirstMessage] =
    useState<OptimisticFirstMessage | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<PreviewAttachment | null>(null);

  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    (store, args) =>
      optimisticallySendMessage(api.chat.listThreadMessages)(store, args),
  );
  const cancelGeneration = useMutation(api.chat.cancelGeneration);
  const ensureDraft = useEnsureDraft();
  const clearDraft = useChatStore((state) => state.clearDraft);
  const newChatToken = useChatStore((state) => state.newChatToken);

  const effectiveThreadId = threadIdProp ?? clientThreadId;

  useEffect(() => {
    if (!isNewChat) return;
    void ensureDraft().catch(() => {});
  }, [ensureDraft, isNewChat]);

  const handleOptimisticResolved = useCallback(() => {
    setOptimisticFirstMessage(null);
  }, []);

  async function handleStop() {
    if (!activeTurn || !effectiveThreadId || isStopping) return;
    setIsStopping(true);
    try {
      await cancelGeneration({ threadId: effectiveThreadId, ...activeTurn });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not stop generation",
      );
    } finally {
      setIsStopping(false);
    }
  }

  async function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed && attachments.length === 0) return;
    const submittedAttachments = attachments;
    const shouldShowOptimisticFirstMessage = isNewChat && !effectiveThreadId;
    const tempId = shouldShowOptimisticFirstMessage
      ? createOptimisticTempId()
      : null;
    setIsSubmitting(true);
    setNotice(null);

    if (shouldShowOptimisticFirstMessage && tempId) {
      setOptimisticFirstMessage({
        tempId,
        prompt: trimmed,
        attachments: submittedAttachments,
        createdAt: Date.now(),
      });
      setShowConversation(true);
      setPrompt("");
      setAttachments([]);
    }

    try {
      const threadId = effectiveThreadId ?? (await ensureDraft());
      const { messageId } = await sendMessage({
        threadId,
        prompt: trimmed,
        attachments:
          submittedAttachments.length > 0 ? submittedAttachments : undefined,
      });

      if (shouldShowOptimisticFirstMessage && tempId) {
        setOptimisticFirstMessage((current) =>
          current?.tempId === tempId ? { ...current, messageId } : current,
        );
        setClientThreadId(threadId);
        clearDraft(newChatToken);
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== `/agent/${threadId}`
        ) {
          window.history.replaceState(null, "", `/agent/${threadId}`);
        }
      }

      setPrompt("");
      setAttachments([]);
    } catch (error) {
      if (shouldShowOptimisticFirstMessage) {
        setOptimisticFirstMessage(null);
        setShowConversation(false);
        setPrompt(trimmed);
        setAttachments(submittedAttachments);
        if (error instanceof Error && error.message === "Thread not found") {
          clearDraft();
        }
      }
      const billing = error instanceof ConvexError ? billingNoticeForError(error.data) : null;
      if (billing) {
        setNotice(billing);
      } else {
        toast.error(
          messageFromError(
            error,
            isNewChat ? "Failed to start conversation" : "Failed to send message",
          ),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const titleContextValue = useMemo(
    () => ({ title: preloadedTitle, setTitle: setPreloadedTitle }),
    [preloadedTitle],
  );
  const messagesStatusContextValue = useMemo(
    () => ({
      status: messagesStatus,
      setStatus: setMessagesStatus,
      activeTurn,
      setActiveTurn,
    }),
    [messagesStatus, activeTurn],
  );
  const composerPrefillContextValue = useMemo(
    () => ({ prefill: setPrompt }),
    [],
  );

  const noticeNode = notice ? <BillingNotice notice={notice} /> : null;
  const composer = (
    <AgentComposer
      value={prompt}
      onChange={(value) => {
        setPrompt(value);
        if (notice) setNotice(null);
      }}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      isGenerating={activeTurn !== null}
      isStopping={isStopping}
      onStop={() => void handleStop()}
      loading={messagesStatus === "LoadingFirstPage" && !optimisticFirstMessage}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
    />
  );

  const hasConversation =
    Boolean(effectiveThreadId) || Boolean(optimisticFirstMessage && showConversation);

  return (
    <ThreadTitleContext.Provider value={titleContextValue}>
      <MessagesStatusContext.Provider value={messagesStatusContextValue}>
        <ComposerPrefillContext.Provider value={composerPrefillContextValue}>
          <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-ink">
            <AgentChatHeader
              title={preloadedTitle ?? "New chat"}
              titleLoading={!isNewChat && preloadedTitle === undefined}
              showDropdown={false}
            />
            {hasConversation ? (
              <>
                <div className="flex min-h-0 flex-1 flex-col">
                  {effectiveThreadId ? (
                    <AgentThread
                      threadId={effectiveThreadId}
                      optimisticFirstMessage={optimisticFirstMessage}
                      onOptimisticResolved={handleOptimisticResolved}
                      onPreview={setPreviewAttachment}
                    />
                  ) : optimisticFirstMessage ? (
                    <OptimisticFirstMessageView
                      message={optimisticFirstMessage}
                      onPreview={setPreviewAttachment}
                    />
                  ) : null}
                </div>
                <div className="shrink-0 px-6 pb-5">
                  <div className="mx-auto w-full max-w-178">
                    {noticeNode}
                    {composer}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 justify-center overflow-auto p-6">
                <div className="relative z-10 my-auto w-full max-w-178">
                  <h1 className="mb-8 text-center text-3xl leading-none font-normal tracking-[-0.01em] text-ink">
                    What do you need help with today?
                  </h1>
                  {noticeNode}
                  {composer}
                </div>
              </div>
            )}
            <PreviewModal
              storageKey={previewAttachment?.key ?? null}
              filename={previewAttachment?.name ?? ""}
              mediaType={previewAttachment?.mediaType}
              onClose={() => setPreviewAttachment(null)}
            />
          </div>
        </ComposerPrefillContext.Provider>
      </MessagesStatusContext.Provider>
    </ThreadTitleContext.Provider>
  );
}
