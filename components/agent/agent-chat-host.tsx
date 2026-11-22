"use client";

import { AgentChat } from "@/components/agent/agent-chat";
import { useChatStore } from "@/lib/chat-store";

export function AgentChatHost() {
  const newChatToken = useChatStore((state) => state.newChatToken);
  return <AgentChat key={newChatToken} />;
}
