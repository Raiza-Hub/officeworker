export type DocumentKind = "all" | "pdf" | "word" | "sheet" | "slide" | "image" | "other";
export type DocumentSizeBucket = "all" | "small" | "medium" | "large";
export type DocumentDateRange = "all" | "today" | "week" | "month";

export type DocumentFilters = {
  kind: DocumentKind;
  size: DocumentSizeBucket;
  date: DocumentDateRange;
  createdAfter?: number;
  showUploading: boolean;
};

export const defaultDocumentFilters: DocumentFilters = {
  kind: "all",
  size: "all",
  date: "all",
  showUploading: true,
};

export function activeDocumentFilterCount(filters: DocumentFilters) {
  let count = 0;
  if (filters.kind !== "all") count++;
  if (filters.size !== "all") count++;
  if (filters.date !== "all") count++;
  if (!filters.showUploading) count++;
  return count;
}

export function createdAfterFor(date: DocumentDateRange): number | undefined {
  if (date === "all") return undefined;
  const now = Date.now();
  if (date === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (date === "week") return now - 7 * 24 * 60 * 60 * 1000;
  if (date === "month") return now - 30 * 24 * 60 * 60 * 1000;
  return undefined;
}

export function documentFiltersToQueryArgs(filters: DocumentFilters) {
  return {
    kind: filters.kind === "all" ? undefined : filters.kind,
    sizeBucket: filters.size === "all" ? undefined : filters.size,
    status: filters.showUploading ? undefined : "Success",
    createdAfter: filters.createdAfter,
  };
}
