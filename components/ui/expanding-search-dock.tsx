"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Search, X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

type ExpandingSearchDockProps = {
  onSearch?: (query: string) => void;
  onQueryChange?: (value: string) => void;
  placeholder?: string;
};

export function ExpandingSearchDock({
  onSearch,
  onQueryChange,
  placeholder = "Search...",
}: ExpandingSearchDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const reduceMotion = useReducedMotion();

  const springTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 30 };
  const instantTransition = { duration: 0 };

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    setQuery("");
    onQueryChange?.("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearch?.(query);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCollapse();
    }
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <m.button
            key="icon"
            type="button"
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            transition={reduceMotion ? instantTransition : undefined}
            onClick={handleExpand}
            aria-label={placeholder}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#dedee3] bg-white transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6874db]/15"
          >
            <Search aria-hidden="true" className="size-3.5 shrink-0 text-text-dim" strokeWidth={2.25} />
          </m.button>
        ) : (
          <m.form
            key="input"
            role="search"
            initial={reduceMotion ? { opacity: 0 } : { width: 28, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { width: 300, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { width: 28, opacity: 0 }}
            transition={springTransition}
            onSubmit={handleSubmit}
            className="relative"
          >
            <m.div
              initial={reduceMotion ? false : { backdropFilter: "blur(0px)" }}
              animate={{ backdropFilter: "blur(12px)" }}
              transition={reduceMotion ? instantTransition : undefined}
              className="relative flex h-8.5 items-center gap-2 overflow-hidden rounded-full border border-[#dedee3] bg-white/90 backdrop-blur-md transition-[border-color,box-shadow] focus-within:border-[#6874db] focus-within:ring-2 focus-within:ring-[#6874db]/15"
            >
              <div className="ml-3">
                <Search aria-hidden="true" className="size-3.5 shrink-0 text-text-dim" strokeWidth={2.25} />
              </div>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  onQueryChange?.(event.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label={placeholder}
                autoFocus
                className="h-8.5 flex-1 bg-transparent pr-1 text-[13px] leading-4 font-medium text-sidebar-text outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
              />
              <m.button
                type="button"
                onClick={handleCollapse}
                aria-label="Clear search"
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={reduceMotion ? instantTransition : undefined}
                whileHover={reduceMotion ? undefined : { scale: 1.1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                className="mr-1.5 flex size-6 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6874db]/15"
              >
                <X aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />
              </m.button>
            </m.div>
          </m.form>
        )}
      </AnimatePresence>
    </div>
  );
}
