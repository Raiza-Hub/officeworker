"use client";

import { AgentChatHeader } from "@/components/agent/agent-chat-header";
import { DocumentView } from "@/components/documents/document-view";
import { DocumentUploadsProvider } from "@/components/documents/document-uploads-context";
import { UploadDocumentsButton } from "@/components/documents/upload-documents-button";

export function DocumentsScreen() {
  return (
    <DocumentUploadsProvider>
      <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-ink">
        <AgentChatHeader
          title="Documents"
          showDropdown={false}
          actions={<UploadDocumentsButton />}
        />
        <DocumentView />
      </div>
    </DocumentUploadsProvider>
  );
}
