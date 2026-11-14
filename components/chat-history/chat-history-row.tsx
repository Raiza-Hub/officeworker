"use client";

import { useRef } from "react";
import { m, useReducedMotion } from "motion/react";
import { ChatHistoryActionsPopover } from "@/components/chat-history/chat-history-actions-popover";
import { ChatHistoryRenameForm } from "@/components/chat-history/chat-history-rename-form";
import { useChatHistoryRowActions } from "@/components/chat-history/use-chat-history-row-actions";
import { SidebarLink } from "@/components/sidebar/sidebar-link";

type ChatHistoryRowProps = {
  threadId: string;
  name: string;
};

export function ChatHistoryRow({ threadId, name }: ChatHistoryRowProps) {
  const reduceMotion = useReducedMotion();
  const rowRef = useRef<HTMLLIElement>(null);
  const {
    isActive,
    isRenaming,
    draftName,
    setDraftName,
    prefetchThread,
    handleDelete,
    startRenaming,
    cancelRenaming,
    saveRenaming,
    markNavigation,
  } = useChatHistoryRowActions(threadId, name, rowRef);

  return (
    <m.li
      ref={rowRef}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
      }
      className="group relative list-none"
      onMouseEnter={prefetchThread}
    >
      {isRenaming ? (
        <div className="flex h-7 w-full items-center rounded-lg px-2">
          <ChatHistoryRenameForm
            value={draftName}
            onChange={setDraftName}
            onSave={saveRenaming}
            onCancel={cancelRenaming}
          />
        </div>
      ) : (
        <>
          <SidebarLink
            href={`/agent/${threadId}`}
            active={isActive}
            onClick={markNavigation}
            onMouseEnter={prefetchThread}
            onFocus={prefetchThread}
            className="pr-9"
          >
            <span className="min-w-0 flex-1 truncate">{name}</span>
          </SidebarLink>
          <div className="absolute top-1/2 right-1 -translate-y-1/2">
            <ChatHistoryActionsPopover
              title={name}
              onRename={startRenaming}
              onDelete={handleDelete}
            />
          </div>
        </>
      )}
    </m.li>
  );
}
