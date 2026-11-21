"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { AgentComposer } from "@/components/agent/agent-composer";
import { type ChatAttachment } from "@/lib/attachments";
import {
  ComposerPrefillContext,
} from "@/components/agent/composer-context";
import {
  MessagesStatusContext,
  ThreadTitleContext,
} from "@/components/agent/thread-contexts";
import {
  BillingNotice,
  billingNoticeForError,
  type BillingNoticeData,
} from "@/components/agent/billing-notice";

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
  const [composerNotice, setComposerNotice] = useState<BillingNoticeData | null>(null);
  const [messagesStatus, setMessagesStatus] = useState("LoadingFirstPage");
  const [activeTurn, setActiveTurn] = useState<{
    promptMessageId: string;
    order: number;
  } | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [preloadedTitle, setPreloadedTitle] = useState<string | null | undefined>(undefined);

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
    setComposerNotice(null);
    try {
      await sendMessage({
        threadId,
        prompt: trimmed,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setPrompt("");
      setAttachments([]);
    } catch (error) {
      const billing = error instanceof ConvexError ? billingNoticeForError(error.data) : null;
      if (billing) {
        setComposerNotice(billing);
      } else {
        const message =
          error instanceof ConvexError &&
          typeof (error.data as { message?: unknown })?.message === "string"
            ? ((error.data as { message: string }).message)
            : error instanceof Error
              ? error.message
              : "Failed to send message";
        toast.error(message);
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

  return (
    <ThreadTitleContext.Provider value={titleContextValue}>
      <MessagesStatusContext.Provider value={messagesStatusContextValue}>
        <ComposerPrefillContext.Provider value={composerPrefillContextValue}>
          <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-ink">
            <AgentChatHeader
              title={preloadedTitle ?? "New chat"}
              titleLoading={preloadedTitle === undefined}
              showDropdown={false}
            />
            <div className="flex min-h-0 flex-1 flex-col">
              {children}
            </div>
            <div className="shrink-0 px-6 pb-5">
              <div className="mx-auto w-full max-w-178">
                {composerNotice && <BillingNotice notice={composerNotice} />}
                <AgentComposer
                  value={prompt}
                  onChange={(value) => {
                    setPrompt(value);
                    if (composerNotice) setComposerNotice(null);
                  }}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  isGenerating={activeTurn !== null}
                  isStopping={isStopping}
                  onStop={() => void handleStop()}
                  loading={messagesStatus === "LoadingFirstPage"}
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
