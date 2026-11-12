"use client";

import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

const notificationTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatNotificationTime(timestamp: number): string {
  return notificationTimeFormatter.format(timestamp);
}

export function ActivityNotifications() {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useConvexAuth();
  const unreadCount = useQuery(
    api.notifications.unseenCount,
    isAuthenticated ? {} : "skip",
  );
  const notifications = useQuery(
    api.notifications.listPage,
    isAuthenticated ? { limit: 20 } : "skip",
  );
  const markSeen = useMutation(api.notifications.markSeen);
  const markAllSeen = useMutation(api.notifications.markAllSeen);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex size-7 items-center justify-center rounded-md text-[#646770] transition-colors hover:bg-[#f0f0f2] hover:text-[#303137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
      >
        <Bell aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
        {Boolean(unreadCount) && (
          <span
            aria-hidden="true"
            className="absolute top-[5px] right-[5px] size-1.5 rounded-full border border-white bg-[#d94b4b]"
          />
        )}
      </button>

      {open && (
        <dialog
          open
          aria-label="Notifications"
          className="m-0 absolute top-9 right-0 z-30 block w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border border-[#e9e9ec] bg-white p-0 shadow-[0_12px_36px_rgba(25,26,31,0.14)]"
        >
          <div className="flex h-11 items-center justify-between border-b border-[#efeff1] px-3.5">
            <h2 className="text-[13px] font-semibold text-[#27282d]">
              Notifications
            </h2>
            {Boolean(unreadCount) && (
              <button
                type="button"
                onClick={() => void markAllSeen({})}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-[#626570] hover:bg-[#f4f4f5] hover:text-[#303137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
              >
                <CheckCheck aria-hidden="true" className="size-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(420px,65vh)] overflow-y-auto">
            {notifications === undefined ? (
              <p className="px-4 py-6 text-center text-[12px] text-[#85878e]">
                Loading notifications…
              </p>
            ) : notifications.page.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-[#85878e]">
                You’re all caught up.
              </p>
            ) : (
              <ul>
                {notifications.page.map((notification) => (
                  <li key={notification._id}>
                    <Link
                      href={notification.data.href}
                      onClick={() => {
                        if (!notification.isSeen) {
                          void markSeen({ notificationId: notification._id });
                        }
                        setOpen(false);
                      }}
                      className={`block border-b border-[#f0f0f2] px-4 py-3 transition-colors hover:bg-[#fafafb] focus-visible:outline-none focus-visible:bg-[#fafafb] ${notification.isSeen ? "" : "bg-[#f8f9ff]"}`}
                    >
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] leading-4 font-medium text-[#303137]">
                            {notification.data.title}
                          </span>
                          <span className="mt-1 block text-[12px] leading-[17px] text-[#686a73]">
                            {notification.data.body}
                          </span>
                          <time
                            dateTime={new Date(notification.createdAt).toISOString()}
                            className="mt-1.5 block text-[10px] leading-3 text-[#92949b]"
                          >
                            {formatNotificationTime(notification.createdAt)}
                          </time>
                        </span>
                        {!notification.isSeen && (
                          <span
                            aria-label="Unread"
                            className="mt-1 size-1.5 shrink-0 rounded-full bg-[#6069d9]"
                          />
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
