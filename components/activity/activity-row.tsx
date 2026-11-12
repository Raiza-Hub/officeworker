"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, MoreHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActivityRowActionsMenu } from "@/components/activity/activity-row-actions-menu";
import { activityTableColumns } from "@/components/activity/activity-table-layout";
import { ActivityRowSkeleton } from "@/components/activity/activity-row-skeleton";
import { usePendingReply } from "@/components/agent/pending-reply-context";

export { ActivityRowSkeleton };

export type Activity = {
  threadId: string;
  name: string;
  created: string;
};

export function ActivityRow({ label }: { label: Activity }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(label.name);
  const [isSaving, setIsSaving] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { markActivityNavigation } = usePendingReply();
  const deleteThread = useMutation(api.chat.deleteThread);
  const renameThread = useMutation(api.chat.renameThread);

  const trimmedDraft = draftName.trim();
  const canSave =
    trimmedDraft.length > 0 && trimmedDraft !== label.name && !isSaving;

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rowRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          router.prefetch(`/agent/${label.threadId}`);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [label.threadId, router]);

  function prefetchThread() {
    router.prefetch(`/agent/${label.threadId}`);
  }

  function handleDelete() {
    deleteThread({ threadId: label.threadId })
      .then(() => toast.success("Chat deleted"))
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "Could not delete the chat",
        ),
      );
  }

  function startRenaming() {
    setDraftName(label.name);
    setIsRenaming(true);
  }

  function cancelRenaming() {
    setDraftName(label.name);
    setIsRenaming(false);
  }

  function saveRenaming() {
    if (isSaving) return;
    if (!canSave) {
      cancelRenaming();
      return;
    }
    setIsSaving(true);
    renameThread({ threadId: label.threadId, title: trimmedDraft })
      .then(() => {
        toast.success("Chat renamed");
        setIsRenaming(false);
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "Could not rename the chat",
        ),
      )
      .finally(() => setIsSaving(false));
  }

  const iconButtonClassName =
    "inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] text-[#4b4c53] transition-colors hover:bg-[lch(94.6%_0_282)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/30 disabled:pointer-events-none disabled:opacity-35";

  return (
    <li
      ref={rowRef}
      className={`group relative grid h-11 list-none ${activityTableColumns} items-center text-[13px] leading-[15.5px] text-[#3f4148] transition-colors hover:bg-[#fcfcfd] ${isMenuOpen || isRenaming ? "bg-[#fcfcfd]" : ""} ${isRenaming ? "" : "cursor-pointer"}`}
      onMouseEnter={prefetchThread}
    >
      <span aria-hidden="true" />

      {isRenaming ? (
        <form
          className="flex min-w-0 items-center gap-1 pl-[2.5px]"
          onSubmit={(event) => {
            event.preventDefault();
            saveRenaming();
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelRenaming();
            }
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draftName}
            maxLength={120}
            aria-label="Chat name"
            disabled={isSaving}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={saveRenaming}
            className="h-8 min-w-0 flex-1 rounded-[8px] border-[0.5px] border-[lch(86%_0_282)] bg-white px-2.5 text-[13px] leading-normal font-medium text-[#292a30] placeholder:text-[#a6a7ad] shadow-[inset_0_1px_2px_lch(0_0_0/0.05)] outline-none transition-[border-color,box-shadow] focus:border-[#626bd9] focus:ring-2 focus:ring-[#626bd9]/20"
          />
          <button
            type="submit"
            aria-label="Save name"
            title="Save name"
            disabled={!canSave}
            onMouseDown={(event) => event.preventDefault()}
            className={iconButtonClassName}
          >
            <Check aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Cancel rename"
            title="Cancel rename"
            disabled={isSaving}
            onMouseDown={(event) => event.preventDefault()}
            onClick={cancelRenaming}
            className={iconButtonClassName}
          >
            <X aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
        </form>
      ) : (
        <Link
          href={`/agent/${label.threadId}`}
          onClick={() => markActivityNavigation(label.threadId)}
          onMouseEnter={prefetchThread}
          onFocus={prefetchThread}
          className="flex min-w-0 items-center gap-[17px] pl-[2.5px] after:absolute after:inset-0"
        >
          <span className="truncate font-medium text-[#292a30]">{label.name}</span>
        </Link>
      )}

      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <time className="whitespace-nowrap text-[12px] leading-[14.5px] font-[450] text-[#5d5f66]">
        {label.created}
      </time>
      {isRenaming ? (
        <span aria-hidden="true" />
      ) : (
        <button
          type="button"
          aria-label={`More actions for ${label.name}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setIsMenuOpen((open) => !open);
          }}
          className={`relative z-10 inline-flex size-8 items-center justify-center rounded-md text-[#656871] transition-[background-color,opacity] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#f1f1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/30 ${isMenuOpen ? "bg-[#f1f1f2] opacity-100" : "opacity-0"}`}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </button>
      )}
      <span aria-hidden="true" />
      {isMenuOpen && !isRenaming && (
        <ActivityRowActionsMenu
          onRename={startRenaming}
          onDelete={handleDelete}
          onClose={() => setIsMenuOpen(false)}
        />
      )}
    </li>
  );
}
