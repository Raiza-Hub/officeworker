"use client";

import { useEffect, useState, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { optimisticallyUpdateValueInPaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePendingReply } from "@/components/agent/pending-reply-context";

export function useChatHistoryRowActions(
  threadId: string,
  name: string,
  rowRef: RefObject<HTMLElement | null>,
) {
  const router = useRouter();
  const pathname = usePathname();
  const { markHistoryNavigation } = usePendingReply();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const deleteThread = useMutation(api.chat.deleteThread).withOptimisticUpdate(
    (localStore, { threadId }) => {
      for (const { args, value } of localStore.getAllQueries(
        api.chat.listThreads,
      )) {
        if (!value) continue;
        localStore.setQuery(api.chat.listThreads, args, {
          ...value,
          page: value.page.filter((thread) => thread.threadId !== threadId),
        });
      }
    },
  );

  const renameThread = useMutation(api.chat.renameThread).withOptimisticUpdate(
    (localStore, { threadId, title }) => {
      optimisticallyUpdateValueInPaginatedQuery(
        localStore,
        api.chat.listThreads,
        {},
        (thread) =>
          thread.threadId === threadId ? { ...thread, title } : thread,
      );
    },
  );

  const isActive = pathname === `/agent/${threadId}`;

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          router.prefetch(`/agent/${threadId}`);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef, router, threadId]);

  function prefetchThread() {
    router.prefetch(`/agent/${threadId}`);
  }

  function handleDelete() {
    void deleteThread({ threadId }).catch((error: unknown) =>
      toast.error(
        error instanceof Error ? error.message : "Could not delete the chat",
      ),
    );
  }

  function startRenaming() {
    setDraftName(name);
    setIsRenaming(true);
  }

  function cancelRenaming() {
    setDraftName(name);
    setIsRenaming(false);
  }

  function saveRenaming() {
    const nextName = draftName.trim();
    if (nextName.length === 0 || nextName === name) {
      cancelRenaming();
      return;
    }
    setDraftName(nextName);
    setIsRenaming(false);
    void renameThread({ threadId, title: nextName }).catch((error: unknown) =>
      toast.error(
        error instanceof Error ? error.message : "Could not rename the chat",
      ),
    );
  }

  function markNavigation() {
    markHistoryNavigation(threadId);
  }

  return {
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
  };
}
