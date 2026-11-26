"use client";

import { ConvexError } from "convex/values";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import {
  billingNoticeForError,
  type BillingNoticeData,
} from "@/components/agent/billing-notice";
import {
  type ActiveTurn,
  type EditableMessage,
  type EditingMessage,
} from "@/store/edit-message";
import { messageFromError } from "@/components/agent/agent-chat-utils";
import type {
  OptimisticFirstMessage,
} from "@/components/agent/optimistic-first-message-types";
import type { ChatAttachment } from "@/lib/attachments";

type UseAgentChatEditActionsArgs = {
  setOptimisticFirstMessage: Dispatch<
    SetStateAction<OptimisticFirstMessage | null>
  >;
  setNotice: Dispatch<SetStateAction<BillingNoticeData | null>>;
  editing: EditingMessage | null;
  setEditing: Dispatch<SetStateAction<EditingMessage | null>>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  attachments: ChatAttachment[];
  setAttachments: Dispatch<SetStateAction<ChatAttachment[]>>;
  activeTurn: ActiveTurn | null;
};

export function useAgentChatEditActions({
  setOptimisticFirstMessage,
  setNotice,
  editing,
  setEditing,
  prompt,
  setPrompt,
  attachments,
  setAttachments,
  activeTurn,
}: UseAgentChatEditActionsArgs) {
  const handleOptimisticResolved = useCallback(() => {
    setOptimisticFirstMessage(null);
  }, [setOptimisticFirstMessage]);

  function reportError(error: unknown, fallback: string) {
    const billing =
      error instanceof ConvexError ? billingNoticeForError(error.data) : null;
    if (billing) {
      setNotice(billing);
    } else {
      toast.error(messageFromError(error, fallback));
    }
  }

  const startEdit = useCallback(
    (message: EditableMessage) => {
      setEditing({
        ...message,
        attachments: message.attachments,
        originalAttachments: message.attachments,
        previousPrompt: prompt,
        previousAttachments: attachments,
        activeTurn,
      });
      setPrompt(message.prompt);
      setAttachments(message.attachments);
      setNotice(null);
    },
    [
      activeTurn,
      attachments,
      prompt,
      setAttachments,
      setEditing,
      setNotice,
      setPrompt,
    ],
  );

  const cancelEdit = useCallback(() => {
    if (!editing) return;
    setPrompt(editing.previousPrompt);
    setAttachments(editing.previousAttachments);
    setEditing(null);
  }, [editing, setAttachments, setEditing, setPrompt]);

  return { handleOptimisticResolved, reportError, startEdit, cancelEdit };
}
