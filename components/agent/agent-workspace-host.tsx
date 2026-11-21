"use client";

import { AgentWorkspace } from "@/components/agent/agent-workspace";
import { useChatStore } from "@/lib/chat-store";

export function AgentWorkspaceHost() {
  const newChatToken = useChatStore((state) => state.newChatToken);
  return <AgentWorkspace key={newChatToken} />;
}
