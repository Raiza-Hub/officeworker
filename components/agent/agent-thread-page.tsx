"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { AgentComposer } from "@/components/agent/agent-composer";
import { type ChatAttachment } from "@/lib/attachments";
import {
  ComposerPrefillContext,
} from "@/components/agent/composer-context";
import { usePendingReply } from "@/components/agent/pending-reply-context";
import {
  MessagesStatusContext,
  ThreadTitleContext,
} from "@/components/agent/thread-contexts";

export function AgentThreadFrame({
  threadId,
  children,
}: {
  threadId: string;
  children: ReactNode;
}) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messagesStatus, setMessagesStatus] = useState("LoadingFirstPage");
  const [activeTurn, setActiveTurn] = useState<{
    promptMessageId: string;
    order: number;
  } | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [preloadedTitle, setPreloadedTitle] = useState<string | null>(null);
  const { pending } = usePendingReply();
  const threadPending = pending?.threadId === threadId ? pending : null;

  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    (store, args) =>
      optimisticallySendMessage(api.chat.listThreadMessages)(store, args),
  );
  const cancelGeneration = useMutation(api.chat.cancelGeneration);

  async function handleStop() {
    if (!activeTurn || isStopping) return;
    setIsStopping(true);
    try {
      await cancelGeneration({ threadId, ...activeTurn });
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
    setIsSubmitting(true);
    try {
      await sendMessage({
        threadId,
        prompt: trimmed,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setPrompt("");
      setAttachments([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message",
      );
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

  return (
    <ThreadTitleContext.Provider value={titleContextValue}>
      <MessagesStatusContext.Provider value={messagesStatusContextValue}>
        <ComposerPrefillContext.Provider value={composerPrefillContextValue}>
          <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
            <AgentChatHeader
              title={preloadedTitle ?? "New chat"}
              showDropdown={false}
            />
            <div className="flex min-h-0 flex-1 flex-col">
              {children}
            </div>
            <div className="shrink-0 px-6 pb-5">
              <div className="mx-auto w-full max-w-[712px]">
                <AgentComposer
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  isGenerating={activeTurn !== null}
                  isStopping={isStopping}
                  onStop={() => void handleStop()}
                  loading={messagesStatus === "LoadingFirstPage" && !threadPending}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                />
              </div>
            </div>
          </div>
        </ComposerPrefillContext.Provider>
      </MessagesStatusContext.Provider>
    </ThreadTitleContext.Provider>
  );
}
