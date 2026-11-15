"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { AgentComposer } from "@/components/agent/agent-composer";
import { type ChatAttachment } from "@/lib/attachments";
import { usePendingReply } from "@/components/agent/pending-reply-context";

export function AgentWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const startThread = useMutation(api.chat.startThread);
  const router = useRouter();
  const { setPending } = usePendingReply();

  async function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed && attachments.length === 0) return;
    setIsSubmitting(true);
    setInlineError(null);
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
      const message = error instanceof Error ? error.message : "Failed to start conversation";
      if (message.toLowerCase().includes("wallet is empty")) {
        setInlineError(message);
      } else {
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
          <AgentComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
          {inlineError && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f1d7a8] bg-[#fff9ed] px-3 py-2.5 text-[13px] text-[#76510e]"
            >
              <span>{inlineError}</span>
              <button
                type="button"
                onClick={() => router.push("/billing")}
                className="shrink-0 rounded-md font-medium underline underline-offset-2"
              >
                Add credits
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
