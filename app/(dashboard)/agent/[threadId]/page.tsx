import { Suspense } from "react";
import { AgentThreadFrame } from "@/components/agent/agent-thread-page";
import { AgentThread } from "@/components/agent/agent-thread";

export default function Page({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <ThreadRoute params={params} />
    </Suspense>
  );
}

async function ThreadRoute({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return (
    <AgentThreadFrame key={threadId} threadId={threadId}>
      <AgentThread threadId={threadId} />
    </AgentThreadFrame>
  );
}
