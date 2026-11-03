import type { Metadata } from "next";
import { Upload } from "lucide-react";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { InboxTeamsView } from "@/components/inbox/inbox-teams-view";

export const metadata: Metadata = {
  title: "Documents | Officeworker",
};

export default function InboxPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      <AgentChatHeader
        title="Documents"
        showDropdown={false}
        actions={
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] leading-4 font-medium text-[#5c5f67] transition-colors hover:bg-[#f0f0f2] hover:text-[#292a30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
          >
            <Upload aria-hidden="true" className="size-3.5" strokeWidth={2} />
            Upload
          </button>
        }
      />
      <InboxTeamsView />
    </div>
  );
}
