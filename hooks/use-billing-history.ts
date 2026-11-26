"use client";

import { useEffect, useRef } from "react";
import { usePaginatedQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";

const PAGE_SIZE = 20;

export function useBillingHistoryData(isAuthenticated: boolean) {
  const {
    results: transactions,
    status: invoiceStatus,
    loadMore: loadMoreInvoices,
  } = usePaginatedQuery(
    api.billing.invoiceHistory,
    isAuthenticated ? {} : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const {
    results: reports,
    status: reportStatus,
    loadMore: loadMoreReports,
  } = usePaginatedQuery(
    api.paymentReports.listMine,
    isAuthenticated ? {} : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  return {
    transactions,
    invoiceStatus,
    loadMoreInvoices,
    reports,
    reportStatus,
    loadMoreReports,
  };
}

export type BillingHistoryData = ReturnType<typeof useBillingHistoryData>;
export type BillingReport = BillingHistoryData["reports"][number];
export type BillingTransaction = BillingHistoryData["transactions"][number];

export function useBillingHistoryEffects(
  activeStatus: string,
  activeLoadMore: (numItems: number) => void,
  view: "invoices" | "reports",
  isLoadingReports: boolean,
  isLoading: boolean,
  reduceMotion: boolean | null,
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const pendingScrollRef = useRef(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || activeStatus !== "CanLoadMore") return;
    const root = sentinel.closest<HTMLElement>("[data-billing-scroll]");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activeLoadMore(PAGE_SIZE);
        }
      },
      { root, rootMargin: "160px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeLoadMore, activeStatus, view]);

  useEffect(() => {
    if (!pendingScrollRef.current) return;
    if (view === "reports" && isLoadingReports) return;
    if (view === "invoices" && isLoading) return;

    pendingScrollRef.current = false;

    let innerRafId: number | undefined;
    const outerRafId = requestAnimationFrame(() => {
      innerRafId = requestAnimationFrame(() => {
        sectionRef.current?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    });

    return () => {
      cancelAnimationFrame(outerRafId);
      if (innerRafId !== undefined) cancelAnimationFrame(innerRafId);
    };
  }, [view, isLoadingReports, isLoading, reduceMotion]);

  return { sentinelRef, sectionRef, pendingScrollRef };
}
