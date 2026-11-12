"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { ChatAttachment } from "@/lib/attachments";

export type PendingReply = {
  threadId: string;
  messageId: string;
  prompt: string;
  attachments: ChatAttachment[];
};

export type ThreadNavigationSource = "agent" | "activity";

type ThreadNavigation = {
  threadId: string;
  source: ThreadNavigationSource;
};

type PendingReplyContextValue = {
  pending: PendingReply | null;
  setPending: (pending: PendingReply) => void;
  clearPending: () => void;
  navigation: ThreadNavigation | null;
  markActivityNavigation: (threadId: string) => void;
};

const PendingReplyContext = createContext<PendingReplyContextValue>({
  pending: null,
  setPending: () => undefined,
  clearPending: () => undefined,
  navigation: null,
  markActivityNavigation: () => undefined,
});

export function PendingReplyProvider({ children }: { children: ReactNode }) {
  const [pending, setPendingState] = useState<PendingReply | null>(null);
  const [navigation, setNavigation] = useState<ThreadNavigation | null>(null);

  const setPending = useCallback((value: PendingReply) => {
    setPendingState(value);
    setNavigation({ threadId: value.threadId, source: "agent" });
  }, []);

  const clearPending = useCallback(() => {
    setPendingState(null);
  }, []);

  const markActivityNavigation = useCallback((threadId: string) => {
    setNavigation({ threadId, source: "activity" });
  }, []);

  const contextValue = useMemo(
    () => ({
      pending,
      setPending,
      clearPending,
      navigation,
      markActivityNavigation,
    }),
    [pending, navigation, setPending, clearPending, markActivityNavigation],
  );

  return (
    <PendingReplyContext.Provider value={contextValue}>
      {children}
    </PendingReplyContext.Provider>
  );
}

export function usePendingReply(): PendingReplyContextValue {
  return useContext(PendingReplyContext);
}
