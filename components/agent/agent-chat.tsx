"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgentChatConversation } from "@/components/agent/agent-chat-conversation";
import { AgentChatEmptyState } from "@/components/agent/agent-chat-empty-state";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { AgentChatNotices } from "@/components/agent/agent-chat-notices";
import { createAgentChatSendActions } from "@/components/agent/agent-chat-send-actions";
import { AgentComposer } from "@/components/agent/agent-composer";
import { ComposerPrefillContext } from "@/components/agent/composer-context";
import { EditMessageContext } from "@/store/edit-message";
import { PreviewModal } from "@/components/agent/preview-modal";
import {
  MessagesStatusContext,
  ThreadTitleContext,
} from "@/store/thread";
import { useAgentChatContextValues } from "@/hooks/use-agent-chat-context-values";
import { useAgentChatCore } from "@/hooks/use-agent-chat-core";
import { useAgentChatDraftSync } from "@/hooks/use-agent-chat-draft-sync";
import { useAgentChatEditActions } from "@/hooks/use-agent-chat-edit-actions";
import {
  findActiveTurn,
  getMessagesStatus,
  getResultsByOrder,
  getThreadTitle,
  getUserOrders,
  useThreadQueries,
  useThreadResults,
  useThreadScope,
  useTurnTimingMap,
  useVisibleResults,
} from "@/hooks/use-agent-thread-state";

export function AgentChat({ threadId: threadIdProp }: { threadId?: string }) {
  const core = useAgentChatCore(threadIdProp);
  const [highlightPrefix, setHighlightPrefix] = useState<string | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = composerTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    });
  }, []);
  useAgentChatDraftSync({
    isNewChat: core.isNewChat,
    ensureDraft: core.ensureDraft,
  });
  const hasThread = Boolean(core.effectiveThreadId);
  const { cacheScope, summary } = useThreadScope(core.effectiveThreadId);
  const { cachedThread, turnTimings, messages } = useThreadQueries(
    core.effectiveThreadId,
    cacheScope,
  );
  const { realResults, results } = useThreadResults(
    cachedThread,
    messages,
    core.optimisticFirstMessage,
  );
  const visibleResults = useVisibleResults(results, core.editing);
  const timingByPromptId = useTurnTimingMap(turnTimings);
  const resultsByOrder = useMemo(
    () => getResultsByOrder(visibleResults),
    [visibleResults],
  );
  const userOrders = useMemo(() => getUserOrders(results), [results]);
  const activeTurn = findActiveTurn(visibleResults, timingByPromptId);
  const preloadedTitle = getThreadTitle(summary, hasThread);
  const messagesStatus = getMessagesStatus(messages, cachedThread, hasThread);
  const { handleOptimisticResolved, reportError, startEdit, cancelEdit } =
    useAgentChatEditActions({
      setOptimisticFirstMessage: core.setOptimisticFirstMessage,
      setNotice: core.setNotice,
      editing: core.editing,
      setEditing: core.setEditing,
      prompt: core.prompt,
      setPrompt: core.setPrompt,
      attachments: core.attachments,
      setAttachments: core.setAttachments,
      activeTurn: activeTurn,
    });
  const { handleStop, handleSubmit } = createAgentChatSendActions({
    activeTurn: activeTurn,
    effectiveThreadId: core.effectiveThreadId,
    isStopping: core.isStopping,
    setIsStopping: core.setIsStopping,
    cancelGeneration: core.cancelGeneration,
    prompt: core.prompt,
    attachments: core.attachments,
    editing: core.editing,
    isNewChat: core.isNewChat,
    ensureDraft: core.ensureDraft,
    sendMessage: core.sendMessage,
    editMessage: core.editMessage,
    clearDraft: core.clearDraft,
    newChatToken: core.newChatToken,
    setNotice: core.setNotice,
    setEditing: core.setEditing,
    setPrompt: core.setPrompt,
    setAttachments: core.setAttachments,
    setOptimisticFirstMessage: core.setOptimisticFirstMessage,
    setShowConversation: core.setShowConversation,
    setClientThreadId: core.setClientThreadId,
    setIsSubmitting: core.setIsSubmitting,
    reportError,
  });
  const {
    titleContextValue,
    messagesStatusContextValue,
    composerPrefillContextValue,
    editMessageContextValue,
  } = useAgentChatContextValues({
    preloadedTitle,
    messagesStatus,
    activeTurn,
    editing: core.editing,

    startEdit,
    cancelEdit,
    setPrompt: core.setPrompt,
    setHighlightPrefix,
    focusComposer,
  });

  const noticeNode = (
    <AgentChatNotices
      editing={core.editing}
      notice={core.notice}
      fileEditPrefix={highlightPrefix}
      onCancelEdit={cancelEdit}
      onDismissNotice={() => core.setNotice(null)}
      onDismissFileEdit={() => setHighlightPrefix(null)}
    />
  );
  const composer = (
    <AgentComposer
      textareaRef={composerTextareaRef}
      value={core.prompt}
      onChange={(value) => {
        core.setPrompt(value);
        setHighlightPrefix((current) =>
          current && value.startsWith(current) ? current : null,
        );
        if (core.notice) core.setNotice(null);
      }}
      onSubmit={() => {
        setHighlightPrefix(null);
        handleSubmit();
      }}
      isSubmitting={core.isSubmitting}
      isGenerating={activeTurn !== null}
      isStopping={core.isStopping}
      onStop={() => void handleStop()}
      loading={
        messagesStatus === "LoadingFirstPage" &&
        !core.optimisticFirstMessage
      }
      attachments={core.attachments}
      onAttachmentsChange={core.setAttachments}
    />
  );

  const hasConversation =
    Boolean(core.effectiveThreadId) ||
    Boolean(core.optimisticFirstMessage && core.showConversation);

  return (
    <ThreadTitleContext.Provider value={titleContextValue}>
      <MessagesStatusContext.Provider value={messagesStatusContextValue}>
        <ComposerPrefillContext.Provider value={composerPrefillContextValue}>
          <EditMessageContext.Provider value={editMessageContextValue}>
            <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-ink">
              <AgentChatHeader
                title={preloadedTitle ?? "New chat"}
                titleLoading={
                  !core.isNewChat && preloadedTitle === undefined
                }
                showDropdown={false}
              />
              {hasConversation ? (
                <AgentChatConversation
                  effectiveThreadId={core.effectiveThreadId}
                  optimisticFirstMessage={core.optimisticFirstMessage}
                  cachedThread={cachedThread}
                  messages={messages}
                  realResults={realResults}
                  visibleResults={visibleResults}
                  timingByPromptId={timingByPromptId}
                  resultsByOrder={resultsByOrder}
                  userOrders={userOrders}
                  onOptimisticResolved={handleOptimisticResolved}
                  onPreview={core.setPreviewAttachment}
                  notice={noticeNode}
                  composer={composer}
                />
              ) : (
                <AgentChatEmptyState notice={noticeNode} composer={composer} />
              )}
              <PreviewModal
                storageKey={core.previewAttachment?.key ?? null}
                filename={core.previewAttachment?.name ?? ""}
                mediaType={core.previewAttachment?.mediaType}
                onClose={() => core.setPreviewAttachment(null)}
              />
            </div>
          </EditMessageContext.Provider>
        </ComposerPrefillContext.Provider>
      </MessagesStatusContext.Provider>
    </ThreadTitleContext.Provider>
  );
}
