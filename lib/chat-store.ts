"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { create } from "zustand";
import { api } from "@/convex/_generated/api";

type ChatStore = {
  newChatToken: number;
  draftToken: number | null;
  draftThreadId: string | null;
  draftPromise: Promise<string> | null;
  startNewChat: () => void;
  setDraftThreadId: (threadId: string | null, token?: number) => void;
  setDraftPromise: (promise: Promise<string> | null, token?: number) => void;
  clearDraft: (token?: number) => void;
};

const initialDraftState = {
  draftToken: null,
  draftThreadId: null,
  draftPromise: null,
};

export const useChatStore = create<ChatStore>((set) => ({
  newChatToken: 0,
  ...initialDraftState,
  startNewChat: () =>
    set((state) => ({
      newChatToken: state.newChatToken + 1,
      draftToken: null,
      draftThreadId: null,
      draftPromise: null,
    })),
  setDraftThreadId: (draftThreadId, token) =>
    set((state) => ({
      draftThreadId,
      draftToken: draftThreadId === null ? null : token ?? state.newChatToken,
    })),
  setDraftPromise: (draftPromise, token) =>
    set((state) => ({
      draftPromise,
      draftToken:
        draftPromise === null && state.draftThreadId === null
          ? null
          : token ?? state.newChatToken,
    })),
  clearDraft: (token) =>
    set((state) =>
      token === undefined ||
      token === state.newChatToken ||
      token === state.draftToken
        ? {
            draftToken: null,
            draftThreadId: null,
            draftPromise: null,
          }
        : state,
    ),
}));

export function useEnsureDraft() {
  const createDraftThread = useMutation(api.chat.createDraftThread);

  return useCallback(() => {
    const state = useChatStore.getState();
    const token = state.newChatToken;

    if (state.draftToken === token && state.draftPromise) {
      return state.draftPromise;
    }

    const promise = createDraftThread({})
      .then(({ threadId }) => {
        const current = useChatStore.getState();
        if (current.newChatToken === token && current.draftPromise === promise) {
          current.setDraftThreadId(threadId, token);
          current.setDraftPromise(null, token);
        }
        return threadId;
      })
      .catch((error: unknown) => {
        const current = useChatStore.getState();
        if (current.newChatToken === token && current.draftPromise === promise) {
          current.setDraftPromise(null, token);
        }
        throw error;
      });

    state.setDraftPromise(promise, token);
    return promise;
  }, [createDraftThread]);
}
