"use client";

import { m, useReducedMotion } from "motion/react";

export function ChatHistoryEmptyState() {
  const reduceMotion = useReducedMotion();

  return (
    <m.p
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }
      }
      className="px-2 py-2 text-[12px] leading-4 text-[#85878e]"
    >
      No chat yet
    </m.p>
  );
}
