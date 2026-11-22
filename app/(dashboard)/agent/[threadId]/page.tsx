import { Suspense } from "react";
import { AgentChat } from "@/components/agent/agent-chat";

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
  return <AgentChat key={threadId} threadId={threadId} />;
}
