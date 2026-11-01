"use client";

import { useState } from "react";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { AgentComposer } from "@/components/agent/agent-composer";
import { AgentExamples } from "@/components/agent/agent-examples";

export function AgentWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [showExamples, setShowExamples] = useState(true);

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      <AgentChatHeader />
      <div className="relative min-h-0 flex-1 overflow-auto p-6">
        <div className="relative z-10 mx-auto w-full max-w-[712px] pt-[calc(50svh-180px)] max-[700px]:pt-24">
          <AgentComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => undefined}
          />
          {showExamples && (
            <AgentExamples
              onSelect={setPrompt}
              onDismiss={() => setShowExamples(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
