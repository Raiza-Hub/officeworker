"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import type {
  ActiveTurn,
  EditableMessage,
  EditingMessage,
} from "@/store/edit-message";

type UseAgentChatContextValuesArgs = {
  preloadedTitle: string | null | undefined;
  messagesStatus: string;
  activeTurn: ActiveTurn | null;
  editing: EditingMessage | null;
  startEdit: (message: EditableMessage) => void;
  cancelEdit: () => void;
  setPrompt: Dispatch<SetStateAction<string>>;
};

export function useAgentChatContextValues({
  preloadedTitle,
  messagesStatus,
  activeTurn,
  editing,
  startEdit,
  cancelEdit,
  setPrompt,
}: UseAgentChatContextValuesArgs) {
  const titleContextValue = useMemo(
    () => ({ title: preloadedTitle }),
    [preloadedTitle],
  );
  const messagesStatusContextValue = useMemo(
    () => ({ status: messagesStatus, activeTurn }),
    [messagesStatus, activeTurn],
  );
  const composerPrefillContextValue = useMemo(
    () => ({ prefill: setPrompt }),
    [setPrompt],
  );
  const editMessageContextValue = useMemo(
    () => ({ editing, startEdit, cancelEdit }),
    [editing, startEdit, cancelEdit],
  );

  return {
    titleContextValue,
    messagesStatusContextValue,
    composerPrefillContextValue,
    editMessageContextValue,
  };
}
