"use client";

import { type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { createOptimisticTempId } from "@/components/agent/agent-chat-utils";
import type { BillingNoticeData } from "@/components/agent/billing-notice";
import type {
  ActiveTurn,
  EditingMessage,
} from "@/store/edit-message";
import type {
  OptimisticFirstMessage,
} from "@/components/agent/optimistic-first-message-types";
import type { ChatAttachment } from "@/lib/attachments";

type CreateAgentChatSendActionsArgs = {
  activeTurn: ActiveTurn | null;
  effectiveThreadId: string | null;
  isStopping: boolean;
  setIsStopping: Dispatch<SetStateAction<boolean>>;
  cancelGeneration: (args: ActiveTurn & { threadId: string }) => Promise<unknown>;
  prompt: string;
  attachments: ChatAttachment[];
  editing: EditingMessage | null;
  isNewChat: boolean;
  ensureDraft: () => Promise<string>;
  sendMessage: (args: {
    threadId: string;
    prompt: string;
    attachments?: ChatAttachment[];
  }) => Promise<{ messageId: string }>;
  editMessage: (args: {
    threadId: string;
    messageId: string;
    prompt: string;
    attachments: ChatAttachment[];
  }) => Promise<unknown>;
  clearDraft: (token?: number) => void;
  newChatToken: number;
  setNotice: Dispatch<SetStateAction<BillingNoticeData | null>>;
  setEditing: Dispatch<SetStateAction<EditingMessage | null>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setAttachments: Dispatch<SetStateAction<ChatAttachment[]>>;
  setOptimisticFirstMessage: Dispatch<
    SetStateAction<OptimisticFirstMessage | null>
  >;
  setShowConversation: Dispatch<SetStateAction<boolean>>;
  setClientThreadId: Dispatch<SetStateAction<string | null>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  reportError: (error: unknown, fallback: string) => void;
};

export function createAgentChatSendActions({
  activeTurn,
  effectiveThreadId,
  isStopping,
  setIsStopping,
  cancelGeneration,
  prompt,
  attachments,
  editing,
  isNewChat,
  ensureDraft,
  sendMessage,
  editMessage,
  clearDraft,
  newChatToken,
  setNotice,
  setEditing,
  setPrompt,
  setAttachments,
  setOptimisticFirstMessage,
  setShowConversation,
  setClientThreadId,
  setIsSubmitting,
  reportError,
}: CreateAgentChatSendActionsArgs) {
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

    if (editing) {
      if (!effectiveThreadId) return;
      const target = editing;
      setIsSubmitting(true);
      setNotice(null);
      try {
        if (target.activeTurn) {
          await cancelGeneration({
            threadId: effectiveThreadId,
            ...target.activeTurn,
          });
        }
        await editMessage({
          threadId: effectiveThreadId,
          messageId: target.id,
          prompt: trimmed,
          attachments,
        });
        setEditing(null);
        setPrompt("");
        setAttachments([]);
      } catch (error) {
        reportError(error, "Failed to edit message");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
      reportError(
        error,
        isNewChat ? "Failed to start conversation" : "Failed to send message",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return { handleStop, handleSubmit };
}
