"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { AgentComposer } from "@/components/agent/agent-composer";
import { type ChatAttachment } from "@/lib/attachments";
import { usePendingReply } from "@/components/agent/pending-reply-context";
import {
  BillingNotice,
  billingNoticeForError,
  type BillingNoticeData,
} from "@/components/agent/billing-notice";

export function AgentWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<BillingNoticeData | null>(null);
  const startThread = useMutation(api.chat.startThread);
  const router = useRouter();
  const { setPending } = usePendingReply();

  async function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed && attachments.length === 0) return;
    setIsSubmitting(true);
    setNotice(null);
    try {
      const { threadId, messageId } = await startThread({
        prompt: trimmed,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setPending({
        threadId,
        messageId,
        prompt: trimmed,
        attachments,
      });
      setPrompt("");
      setAttachments([]);
      router.replace(`/agent/${threadId}`);
    } catch (error) {
      const billing = error instanceof ConvexError ? billingNoticeForError(error.data) : null;
      if (billing) {
        setNotice(billing);
      } else {
        const message =
          error instanceof ConvexError &&
          typeof (error.data as { message?: unknown })?.message === "string"
            ? ((error.data as { message: string }).message)
            : error instanceof Error
              ? error.message
              : "Failed to start conversation";
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-ink">
      <AgentChatHeader showDropdown={false} />
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-6">
        <div className="relative z-10 my-auto w-full max-w-178">
          <h1 className="mb-8 text-center text-3xl leading-none font-normal tracking-[-0.01em] text-ink">
            What do you need help with today?
          </h1>
          {notice && <BillingNotice notice={notice} />}
          <AgentComposer
            value={prompt}
            onChange={(value) => {
              setPrompt(value);
              if (notice) setNotice(null);
            }}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </div>
      </div>
    </div>
  );
}
