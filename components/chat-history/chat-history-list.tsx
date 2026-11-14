"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useConvexAuth } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { ChatHistoryRow } from "@/components/chat-history/chat-history-row";
import { ChatHistoryRowSkeleton } from "@/components/chat-history/chat-history-row-skeleton";
import { ChatHistoryEmptyState } from "@/components/chat-history/chat-history-empty-state";

const PAGE_SIZE = 20;

export function ChatHistoryList() {
  const { isAuthenticated } = useConvexAuth();
  const reduceMotion = useReducedMotion();
  const { results, status, loadMore } = usePaginatedQuery(
    api.chat.listThreads,
    isAuthenticated ? {} : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || status !== "CanLoadMore") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore(PAGE_SIZE);
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, status]);

  if (status === "LoadingFirstPage") {
    return (
      <ul className="flex flex-col gap-px">
        {Array.from({ length: 4 }).map((_, index) => (
          <ChatHistoryRowSkeleton key={index} index={index} />
        ))}
      </ul>
    );
  }

  if (results.length === 0) {
    return <ChatHistoryEmptyState />;
  }

  return (
    <m.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
      }
    >
      <ul className="flex flex-col gap-px">
        {results.map((thread) => (
          <ChatHistoryRow
            key={thread.threadId}
            threadId={thread.threadId}
            name={thread.title?.trim() || "New chat"}
          />
        ))}
      </ul>
      {status === "LoadingMore" && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
          className="flex items-center justify-center py-2"
        >
          <LoaderCircle
            aria-label="Loading more chats"
            className="size-4 animate-spin text-[#85878e]"
            strokeWidth={2}
          />
        </m.div>
      )}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
    </m.div>
  );
}
