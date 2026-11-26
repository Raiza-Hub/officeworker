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
  onCancelEdit: () => void;
  onDismissNotice: () => void;
};

export function AgentChatNotices({
  editing,
  notice,
  onCancelEdit,
  onDismissNotice,
}: AgentChatNoticesProps) {
  return (
    <AnimatePresence>
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
