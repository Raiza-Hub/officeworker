"use client";

import { useEffect } from "react";

type UseAgentChatDraftSyncArgs = {
  isNewChat: boolean;
  ensureDraft: () => Promise<string>;
};

export function useAgentChatDraftSync({
  isNewChat,
  ensureDraft,
}: UseAgentChatDraftSyncArgs) {
  useEffect(() => {
    if (!isNewChat) return;
    void ensureDraft().catch(() => {});
  }, [ensureDraft, isNewChat]);
}
