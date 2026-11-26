import type { ChatAttachment } from "@/lib/attachments";

export type OptimisticFirstMessage = {
  tempId: string;
  messageId?: string;
  prompt: string;
  attachments: ChatAttachment[];
  createdAt: number;
};
