"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { fileEditPrefixForName } from "@/lib/submission-card";
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
  setHighlightPrefix: Dispatch<SetStateAction<string | null>>;
  focusComposer: () => void;
};

export function useAgentChatContextValues({
  preloadedTitle,
  messagesStatus,
  activeTurn,
  editing,
  startEdit,
  cancelEdit,
  setPrompt,
  setHighlightPrefix,
  focusComposer,
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
    () => ({
      prefill: (
        text: string,
        options?: { focus?: boolean; highlight?: boolean },
      ) => {
        setPrompt(text);
        setHighlightPrefix(options?.highlight ? text : null);
        if (options?.focus) focusComposer();
      },
      startFileEdit: (fileName: string) => {
        setPrompt("");
        setHighlightPrefix(fileEditPrefixForName(fileName));
        focusComposer();
      },
    }),
    [focusComposer, setHighlightPrefix, setPrompt],
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
