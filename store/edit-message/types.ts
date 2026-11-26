import { type ChatAttachment } from "@/lib/attachments";

export type ActiveTurn = {
  promptMessageId: string;
  order: number;
};

export type EditableMessage = {
  id: string;
  order: number;
  prompt: string;
  attachments: ChatAttachment[];
};

export type EditingMessage = EditableMessage & {
  originalAttachments: ChatAttachment[];
  previousPrompt: string;
  previousAttachments: ChatAttachment[];
  activeTurn: ActiveTurn | null;
};

export type EditMessage = {
  editing: EditingMessage | null;
  startEdit: (message: EditableMessage) => void;
  cancelEdit: () => void;
};
