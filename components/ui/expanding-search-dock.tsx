"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";
import {
  CollapsedSearchButton,
  ExpandedSearchForm,
  type SearchDockTransition,
} from "./expanding-search-dock-parts";

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

  const springTransition: SearchDockTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 300, damping: 30 };
  const instantTransition: SearchDockTransition = { duration: 0 };

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

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <ExpandedSearchForm
            key="input"
            query={query}
            placeholder={placeholder}
            reduceMotion={reduceMotion}
            springTransition={springTransition}
            instantTransition={instantTransition}
            onSubmit={handleSubmit}
            onQueryChange={handleQueryChange}
            onCollapse={handleCollapse}
          />
        ) : (
          <CollapsedSearchButton
            key="icon"
            placeholder={placeholder}
            reduceMotion={reduceMotion}
            instantTransition={instantTransition}
            onExpand={handleExpand}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
