"use client";

import { AnimatePresence } from "motion/react";
import {
  BillingNotice,
  type BillingNoticeData,
} from "@/components/agent/billing-notice";
import type { EditingMessage } from "@/store/edit-message";

type AgentChatNoticesProps = {
  editing: EditingMessage | null;
  notice: BillingNoticeData | null;
  fileEditPrefix?: string | null;
  onCancelEdit: () => void;
  onDismissNotice: () => void;
  onDismissFileEdit?: () => void;
};

export function AgentChatNotices({
  editing,
  notice,
  fileEditPrefix,
  onCancelEdit,
  onDismissNotice,
  onDismissFileEdit,
}: AgentChatNoticesProps) {
  const fileEditName = fileEditPrefix?.trim();
  const fileEditNotice = fileEditName
    ? {
        code: "EDITING" as const,
        message: "Editing ",
        highlight: fileEditName,
      }
    : null;

  return (
    <AnimatePresence>
      {fileEditNotice && (
        <BillingNotice
          key={`file-edit:${fileEditNotice.highlight}`}
          notice={fileEditNotice}
          onDismiss={onDismissFileEdit}
          dismissLabel="Close file editing"
        />
      )}
      {editing && (
        <BillingNotice
          key={`edit:${editing.id}`}
          notice={{ code: "EDITING", message: "Editing message" }}
          onDismiss={onCancelEdit}
          dismissLabel="Cancel editing"
        />
      )}
      {notice && (
        <BillingNotice
          key={notice.code}
          notice={notice}
          onDismiss={onDismissNotice}
        />
      )}
    </AnimatePresence>
  );
}
