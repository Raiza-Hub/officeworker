"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ChatHistoryList } from "@/components/chat-history/chat-history-list";

export function ChatHistorySection() {
  const [isExpanded, setIsExpanded] = useState(true);
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((v) => !v)}
        className="flex h-7 w-full shrink-0 items-center gap-1 rounded-lg px-[5px] text-left text-xs leading-3.5 font-medium text-[#62656d] transition-colors duration-100 ease-out hover:bg-secondary hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40 motion-reduce:transition-none"
      >
        <span className="flex-1">Chat history</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 shrink-0 text-[#858890] transition-transform duration-150 ${isExpanded ? "" : "-rotate-90"}`}
          strokeWidth={2.25}
        />
      </button>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {isExpanded && (
            <m.div
              key="chat-history-viewport"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -4, filter: "blur(4px)" }
              }
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -4, filter: "blur(4px)" }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 0.2,
                      ease: "easeOut",
                    }
              }
              className="absolute inset-0"
            >
              <div className="h-full min-h-0 overflow-y-auto overscroll-none pt-[3px] pb-1">
                <ChatHistoryList />
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5"
                style={{
                  background:
                    "linear-gradient(to bottom, var(--color-sidebar-bg), rgba(245, 245, 246, 0))",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5"
                style={{
                  background:
                    "linear-gradient(to top, var(--color-sidebar-bg), rgba(245, 245, 246, 0))",
                }}
              />
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
