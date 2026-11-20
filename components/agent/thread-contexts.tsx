"use client";

import { createContext, useContext } from "react";

type ThreadTitleValue = {
  title: string | null | undefined;
  setTitle: (title: string | null | undefined) => void;
};

const ThreadTitleContext = createContext<ThreadTitleValue>({
  title: undefined,
  setTitle: () => undefined,
});

export function useThreadTitle(): ThreadTitleValue {
  return useContext(ThreadTitleContext);
}

export { ThreadTitleContext };

type MessagesStatusValue = {
  status: string;
  setStatus: (status: string) => void;
  activeTurn: { promptMessageId: string; order: number } | null;
  setActiveTurn: (
    turn: { promptMessageId: string; order: number } | null,
  ) => void;
};

const MessagesStatusContext = createContext<MessagesStatusValue>({
  status: "LoadingFirstPage",
  setStatus: () => undefined,
  activeTurn: null,
  setActiveTurn: () => undefined,
});

export function useMessagesStatus(): MessagesStatusValue {
  return useContext(MessagesStatusContext);
}

export { MessagesStatusContext };
