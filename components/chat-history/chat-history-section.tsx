"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ChatHistoryList } from "@/components/chat-history/chat-history-list";

export function ChatHistorySection() {
  const [isExpanded, setIsExpanded] = useState(true);
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((v) => !v)}
        className="flex h-7 w-full items-center gap-1 rounded-lg px-[5px] text-left text-[12px] leading-[14px] font-medium text-[#62656d] transition-colors duration-100 ease-out hover:bg-[#f3f3f4] hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40 motion-reduce:transition-none"
      >
        <span className="flex-1">Chat history</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 shrink-0 text-[#858890] transition-transform duration-150 ${isExpanded ? "" : "-rotate-90"}`}
          strokeWidth={2.25}
        />
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <m.div
            key="chat-history-content"
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
            className="pt-[3px] pb-1"
          >
            <ChatHistoryList />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
