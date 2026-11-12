"use client";

import { ArrowDown } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { ActivityRow, ActivityRowSkeleton, type Activity } from "@/components/activity/activity-row";
import { activityTableColumns } from "@/components/activity/activity-table-layout";

function SortableHeader({ children, sorted = false }: { children: string; sorted?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Order by ${children}${sorted ? ", sorted ascending" : ""}`}
      className="inline-flex h-6 items-center gap-1 rounded-md px-0 text-left text-[12px] leading-[14.5px] font-[450] text-[#5b5d65] transition-colors hover:text-[#292a30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/30"
    >
      {children}
      <ArrowDown
        aria-hidden="true"
        className="size-3"
        strokeWidth={2}
        opacity={sorted ? 1 : 0}
      />
    </button>
  );
}

function ActivityTableHeader() {
  return (
    <div className={`grid h-8 items-center ${activityTableColumns} text-[#5b5d65]`}>
      <span aria-hidden="true" />
      <div className="flex items-center pl-0">
        <SortableHeader sorted>Name</SortableHeader>
      </div>
      <div className="flex items-center">
        <SortableHeader>Status</SortableHeader>
      </div>
      <div className="flex items-center">
        <SortableHeader>Documents</SortableHeader>
      </div>
      <div className="flex items-center">
        <SortableHeader>Created</SortableHeader>
      </div>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActivityTable() {
  const threads = useQuery(api.chat.listThreads, {
    paginationOpts: { cursor: null, numItems: 30 },
  });

  const isLoading = threads === undefined;

  const rows: Activity[] = (threads?.page ?? []).map((thread) => ({
    threadId: thread.threadId,
    name: thread.title?.trim() || "New chat",
    created: formatDate(thread.lastActivityAt),
  }));

  return (
    <div className="min-w-[900px] text-[#24252a]">
      <ActivityTableHeader />
      <ul aria-label="Chat activity" className="list-none">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <ActivityRowSkeleton key={index} index={index} />
          ))
        ) : (
          <>
            {rows.map((row) => (
              <ActivityRow key={row.threadId} label={row} />
            ))}
            {rows.length === 0 && (
              <li className="list-none px-[2.5px] py-6 text-[13px] leading-[20px] text-[#85878e]">
                No chats yet. Start one from the Agent page.
              </li>
            )}
          </>
        )}
      </ul>
    </div>
  );
}
