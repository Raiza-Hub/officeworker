import type { Metadata } from "next";
import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { DocumentView } from "@/components/documents/document-view";
import { UploadDocumentsButton } from "@/components/documents/upload-documents-button";

export const metadata: Metadata = {
  title: "Documents | Officeworker",
};

export default function DocumentsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      <AgentChatHeader
        title="Documents"
        showDropdown={false}
        actions={<UploadDocumentsButton />}
      />
      <DocumentView />
    </div>
  );
}
