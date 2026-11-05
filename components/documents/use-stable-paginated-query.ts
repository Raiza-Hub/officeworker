"use client";

import { useRef } from "react";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export const DOCUMENTS_PAGE_SIZE = 50;

type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

type StableDocumentSearch = {
  results: Doc<"documents">[];
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
  searchTerm: string;
};

/**
 * Adapted from useStablePaginatedQuery in get-convex/convex-helpers
 * (https://stack.convex.dev/help-my-app-is-overreacting): when the search
 * term changes, it keeps returning the previously loaded results until the
 * new first page has loaded, so the list does not flash empty mid-refetch.
 * The returned results are paired with the search term they were fetched for.
 * The render-phase ref capture is the stable-results mechanic from that
 * official recipe, hence the two scoped react-hooks rule dispositions below.
 */
export function useStableDocumentSearch(searchTerm: string): StableDocumentSearch {
  const { isAuthenticated } = useConvexAuth();
  const result = usePaginatedQuery(
    api.documents.searchList,
    isAuthenticated ? { searchTerm } : "skip",
    { initialNumItems: DOCUMENTS_PAGE_SIZE },
  );
  const isLive =
    result.status !== "LoadingFirstPage" && result.status !== "LoadingMore";
  const live: StableDocumentSearch = {
    results: result.results,
    status: result.status,
    loadMore: result.loadMore,
    searchTerm,
  };
  const stored = useRef(live);
  // eslint-disable-next-line react-hooks/refs -- deliberate snapshot capture, see comment above
  if (isLive) stored.current = live;
  // eslint-disable-next-line react-hooks/refs -- stale snapshot is returned while loading
  return stored.current;
}
