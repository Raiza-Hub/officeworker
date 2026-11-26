"use client";

import type { ReactNode } from "react";

type AgentChatEmptyStateProps = {
  notice: ReactNode;
  composer: ReactNode;
};

export function AgentChatEmptyState({
  notice,
  composer,
}: AgentChatEmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto p-6">
      <div className="relative z-10 my-auto w-full max-w-178">
        <h1 className="mb-8 text-center text-3xl leading-none font-normal tracking-[-0.01em] text-ink">
          What do you need help with today?
        </h1>
        {notice}
        {composer}
      </div>
    </div>
  );
}
