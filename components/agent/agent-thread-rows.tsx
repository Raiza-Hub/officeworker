"use client";

import type {
  EditableMessage,
  EditingMessage,
} from "@/store/edit-message";
import { MessageActions } from "@/components/agent/message-actions";
import { partText, type UIMessagePartList } from "@/components/agent/parts";
import { Reasoning } from "@/components/agent/reasoning";
import { SubmissionCard } from "@/components/agent/submission-card";
import type { CachedThreadMessage } from "@/hooks/use-cached-thread-messages";
import {
  AssistantMessage,
  UserPromptBubble,
} from "@/components/agent/thread-message-parts";
import type { PreviewAttachment } from "@/lib/file-preview-types";
import {
  assistantPlainText,
  extractSubmissionIds,
  finalAssistantParts,
} from "@/components/agent/thread-helpers";
import type { ThreadTiming } from "@/hooks/use-agent-thread-state";

export function AssistantThreadMessage({
  message,
  parts,
}: {
  message: CachedThreadMessage;
  parts: UIMessagePartList;
}) {
  const copyText = assistantPlainText(finalAssistantParts(parts));
  const submissionIds = extractSubmissionIds(parts);
  return (
    <div key={message.id} className="flex w-full flex-col gap-2.5 items-start">
      <div className="group/message flex w-full flex-col gap-2.5 items-start">
        <div className="w-full">
          <AssistantMessage
            parts={parts}
            status={message.status}
            isStreaming={message.status === "streaming"}
          />
        </div>
        {message.status !== "streaming" && copyText && (
          <MessageActions text={copyText} />
        )}
      </div>
      {submissionIds.map((id) => (
        <div key={id} className="w-full">
          <SubmissionCard submissionId={id} />
        </div>
      ))}
    </div>
  );
}

export function UserThreadMessage({
  message,
  parts,
  attachments,
  assistant,
  assistantParts,
  timing,
  isStreaming,
  editing,
  startEdit,
  onPreview,
  isReconnecting,
  connectionRetries,
}: {
  message: CachedThreadMessage;
  parts: UIMessagePartList;
  attachments: PreviewAttachment[];
  assistant: CachedThreadMessage | undefined;
  assistantParts: UIMessagePartList;
  timing: ThreadTiming | undefined;
  isStreaming: boolean;
  editing: EditingMessage | null;
  startEdit: (message: EditableMessage) => void;
  onPreview: (attachment: PreviewAttachment) => void;
  isReconnecting: boolean;
  connectionRetries: number;
}) {
  const userText = parts.map(partText).join("");
  const copyText = assistantPlainText(finalAssistantParts(assistantParts));
  const userOrder = typeof message.order === "number" ? message.order : null;
  return (
    <div key={message.id} className="flex w-full flex-col gap-4 items-end">
      <div className="group/prompt flex w-full flex-col gap-1.5 items-end">
        <UserPromptBubble
          text={userText}
          attachments={attachments}
          onPreview={onPreview}
        />
        <MessageActions
          text={userText}
          revealGroup="prompt"
          onEdit={
            editing || userOrder === null
              ? undefined
              : () =>
                  startEdit({
                    id: message.id,
                    order: userOrder,
                    prompt: userText,
                    attachments,
                  })
          }
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
            connectionRetries={connectionRetries}
          />
        </div>
        {assistant && (
          <div className="flex flex-col gap-2.5 items-start">
            <div className="group/message flex flex-col gap-2.5 items-start">
              <div className="w-full">
                <AssistantMessage
                  parts={finalAssistantParts(assistantParts)}
                  status={assistant.status}
                  isStreaming={assistant.status === "streaming"}
                  cancelled={timing?.status === "cancelled"}
                />
              </div>
              {assistant.status !== "streaming" && copyText && (
                <MessageActions text={copyText} />
              )}
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
}

export function ThreadMessageRow({
  message,
  userOrders,
  resultsByOrder,
  timingByPromptId,
  editing,
  startEdit,
  onPreview,
  lastMessageId,
  isReconnecting,
  connectionRetries,
}: {
  message: CachedThreadMessage;
  userOrders: Set<number>;
  resultsByOrder: Map<number, CachedThreadMessage>;
  timingByPromptId: Map<string, ThreadTiming>;
  editing: EditingMessage | null;
  startEdit: (message: EditableMessage) => void;
  onPreview: (attachment: PreviewAttachment) => void;
  lastMessageId: string | undefined;
  isReconnecting: boolean;
  connectionRetries: number;
}) {
  const isUser = message.role === "user";
  if (!isUser && typeof message.order === "number" && userOrders.has(message.order)) {
    return null;
  }
  const parts = (message.parts ?? []) as UIMessagePartList;
  const attachments = Array.isArray((message as { attachments?: unknown }).attachments)
    ? ((message as { attachments?: PreviewAttachment[] }).attachments ?? [])
    : [];

  if (!isUser) {
    return <AssistantThreadMessage message={message} parts={parts} />;
  }

  const assistant =
    typeof message.order === "number" ? resultsByOrder.get(message.order) : undefined;
  const assistantParts = (assistant?.parts ?? []) as UIMessagePartList;
  const timing = timingByPromptId.get(message.id);
  const isStreaming =
    assistant?.status === "streaming" ||
    timing?.status === "running" ||
    message.status === "pending" ||
    (!assistant && message.id === lastMessageId);

  return (
    <UserThreadMessage
      message={message}
      parts={parts}
      attachments={attachments}
      assistant={assistant}
      assistantParts={assistantParts}
      timing={timing}
      isStreaming={isStreaming}
      editing={editing}
      startEdit={startEdit}
      onPreview={onPreview}
      isReconnecting={isReconnecting}
      connectionRetries={connectionRetries}
    />
  );
}
