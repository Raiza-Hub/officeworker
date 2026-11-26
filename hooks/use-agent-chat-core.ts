"use client";

import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { BillingNoticeData } from "@/components/agent/billing-notice";
import type { EditingMessage } from "@/store/edit-message";
import type {
  OptimisticFirstMessage,
} from "@/components/agent/optimistic-first-message-types";
import type { PreviewAttachment } from "@/lib/file-preview-types";
import type { ChatAttachment } from "@/lib/attachments";
import { useChatStore, useEnsureDraft } from "@/lib/chat-store";

export function useAgentChatCore(threadIdProp: string | undefined) {
  const isNewChat = threadIdProp === undefined;
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<BillingNoticeData | null>(null);
  const [editing, setEditing] = useState<EditingMessage | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [clientThreadId, setClientThreadId] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(!isNewChat);
  const [optimisticFirstMessage, setOptimisticFirstMessage] =
    useState<OptimisticFirstMessage | null>(null);
  const [previewAttachment, setPreviewAttachment] =
    useState<PreviewAttachment | null>(null);

  const sendMessage = useMutation(api.chat.sendMessage).withOptimisticUpdate(
    (store, args) =>
      optimisticallySendMessage(api.chat.listThreadMessages)(store, args),
  );
  const cancelGeneration = useMutation(api.chat.cancelGeneration);
  const editMessage = useMutation(api.chat.editMessage);
  const ensureDraft = useEnsureDraft();
  const clearDraft = useChatStore((state) => state.clearDraft);
  const newChatToken = useChatStore((state) => state.newChatToken);

  const effectiveThreadId = threadIdProp ?? clientThreadId;

  return {
    isNewChat,
    effectiveThreadId,
    prompt,
    setPrompt,
    attachments,
    setAttachments,
    isSubmitting,
    setIsSubmitting,
    notice,
    setNotice,
    editing,
    setEditing,
    isStopping,
    setIsStopping,
    clientThreadId,
    setClientThreadId,
    showConversation,
    setShowConversation,
    optimisticFirstMessage,
    setOptimisticFirstMessage,
    previewAttachment,
    setPreviewAttachment,
    sendMessage,
    cancelGeneration,
    editMessage,
    ensureDraft,
    clearDraft,
    newChatToken,
  };
}
