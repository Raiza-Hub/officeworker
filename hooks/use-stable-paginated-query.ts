"use client";

import { useEffect, useMemo } from "react";
import { useConvexAuth } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  defaultDocumentFilters,
  documentFiltersToQueryArgs,
  type DocumentFilters,
} from "@/components/documents/document-filters";

export const DOCUMENTS_PAGE_SIZE = 50;

type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

type StableDocumentSearch = {
  results: Doc<"documents">[];
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
  searchTerm: string;
};

const liveSnapshots = new WeakMap<object, StableDocumentSearch>();

/**
 * Adapted from useStablePaginatedQuery in get-convex/convex-helpers
 * (https://stack.convex.dev/help-my-app-is-overreacting): when the search
 * term changes, it keeps returning the previously loaded results until the
 * new first page has loaded, so the list does not flash empty mid-refetch.
 * The returned results are paired with the search term they were fetched for.
 */
export function useStableDocumentSearch(
  searchTerm: string,
  filters: DocumentFilters = defaultDocumentFilters,
): StableDocumentSearch {
  const { isAuthenticated } = useConvexAuth();
  const filterArgs = useMemo(() => documentFiltersToQueryArgs(filters), [filters]);
  const queryArgs = useMemo(
    () => (isAuthenticated ? { searchTerm, ...filterArgs } : "skip"),
    [isAuthenticated, searchTerm, filterArgs],
  );
  const result = usePaginatedQuery(api.documents.searchList, queryArgs, {
    initialNumItems: DOCUMENTS_PAGE_SIZE,
  });
  const isLive =
    result.status !== "LoadingFirstPage" && result.status !== "LoadingMore";
  const live = useMemo<StableDocumentSearch>(
    () => ({
      results: result.results,
      status: result.status,
      loadMore: result.loadMore,
      searchTerm,
    }),
    [result.results, result.status, result.loadMore, searchTerm],
  );
  const snapshotKey = useMemo(() => ({}), []);
  useEffect(() => {
    if (isLive) liveSnapshots.set(snapshotKey, live);
  }, [isLive, live, snapshotKey]);
  return isLive ? live : (liveSnapshots.get(snapshotKey) ?? live);
}
