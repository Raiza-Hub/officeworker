"use client";

import { createContext, useContext } from "react";
import type { ActiveTurn } from "@/store/edit-message";

type ThreadTitleValue = {
  title: string | null | undefined;
};

const ThreadTitleContext = createContext<ThreadTitleValue>({
  title: undefined,
});

export function useThreadTitle(): ThreadTitleValue {
  return useContext(ThreadTitleContext);
}

export { ThreadTitleContext };

type MessagesStatusValue = {
  status: string;
  activeTurn: ActiveTurn | null;
};

const MessagesStatusContext = createContext<MessagesStatusValue>({
  status: "LoadingFirstPage",
  activeTurn: null,
});

export function useMessagesStatus(): MessagesStatusValue {
  return useContext(MessagesStatusContext);
}

export { MessagesStatusContext };
