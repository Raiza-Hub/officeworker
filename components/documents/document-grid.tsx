"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStableDocumentSearch, DOCUMENTS_PAGE_SIZE } from "@/components/documents/use-stable-paginated-query";
import { DocumentEmptyState } from "@/components/documents/document-empty-state";
import { DocumentGridSkeleton } from "@/components/documents/document-grid-skeleton";
import { AttachmentThumbnail } from "@/components/agent/attachment-thumbnail";
import { PreviewModal } from "@/components/agent/preview-modal";
import { isPreviewSupported } from "@/lib/file-types";
import {
  useDocumentUploads,
  type DocumentUploadItem,
} from "@/components/documents/document-uploads-context";
import {
  activeDocumentFilterCount,
  defaultDocumentFilters,
  type DocumentFilters,
} from "@/components/documents/document-filters";
import type { Doc } from "@/convex/_generated/dataModel";

type PreviewDoc = {
  storageKey: string;
  name: string;
  type: string;
};

function FailedActions({ item }: { item: DocumentUploadItem }) {
  const { retryUpload, dismissUpload } = useDocumentUploads();
  return (
    <div className="flex w-full items-center justify-between gap-1">
      <button
        type="button"
        aria-label={`Try uploading ${item.name} again`}
        onClick={() => retryUpload(item.id)}
        className="inline-flex items-center gap-0.5 rounded-full px-1 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40"
      >
        <RotateCcw aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />
        <span className="whitespace-nowrap">Try again</span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${item.name}`}
        onClick={() => dismissUpload(item.id)}
        className="inline-flex items-center gap-0.5 rounded-full px-1 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-danger-bg hover:text-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40"
      >
        <Trash2 aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />
        <span className="whitespace-nowrap">Delete</span>
      </button>
    </div>
  );
}

function TrackerTile({ item }: { item: DocumentUploadItem }) {
  const { cancelUpload } = useDocumentUploads();
  if (item.phase === "failed") {
    return (
      <AttachmentThumbnail
        attachment={{
          name: item.name,
          mediaType: item.file.type || "application/octet-stream",
        }}
        className="w-full"
        nameLines={2}
        footer={<FailedActions item={item} />}
      />
    );
  }
  const isCanceling = item.phase === "canceling";
  return (
    <AttachmentThumbnail
      attachment={{
        key: item.storageKey ?? undefined,
        name: item.name,
        mediaType: item.file.type || "application/octet-stream",
      }}
      className="w-full"
      nameLines={2}
      isUploading
      progress={item.phase === "preparing" ? null : item.progress}
      onCancel={isCanceling ? undefined : () => cancelUpload(item.id)}
    />
  );
}

function DocumentTile({
  doc,
  tracker,
  onPreview,
}: {
  doc: Doc<"documents">;
  tracker: DocumentUploadItem | undefined;
  onPreview: (doc: PreviewDoc) => void;
}) {
  const { cancelUpload } = useDocumentUploads();
  const isUploading = doc.status === "Uploading";
  if (isUploading) {
    const progress: number | null =
      tracker && (tracker.phase === "uploading" || tracker.phase === "canceling")
        ? tracker.progress
        : null;
    const canCancel = tracker && tracker.phase === "uploading";
    return (
      <AttachmentThumbnail
        attachment={{
          key: doc.storageKey,
          name: doc.name,
          mediaType: doc.type,
        }}
        className="w-full"
        nameLines={2}
        isUploading
        progress={progress}
        onCancel={canCancel ? () => cancelUpload(tracker.id) : undefined}
      />
    );
  }

  const previewSupported = isPreviewSupported(doc.name, doc.type);
  return (
    <AttachmentThumbnail
      attachment={{
        key: doc.storageKey,
        name: doc.name,
        mediaType: doc.type,
      }}
      className="w-full"
      nameLines={2}
      onPreview={
        previewSupported
          ? () =>
              onPreview({
                storageKey: doc.storageKey,
                name: doc.name,
                type: doc.type,
              })
          : () =>
              toast.error("Preview unavailable", {
                id: `preview-unsupported-${doc.storageKey}`,
                description:
                  "This file format can't be displayed in the browser. Download it to view the contents.",
              })
      }
    />
  );
}

export function DocumentGrid({
  searchTerm,
  filters = defaultDocumentFilters,
}: {
  searchTerm: string;
  filters?: DocumentFilters;
}) {
  const { results, status, loadMore, searchTerm: shownTerm } =
    useStableDocumentSearch(searchTerm, filters);
  const { items, resumeStaleUpload } = useDocumentUploads();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || status !== "CanLoadMore") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore(DOCUMENTS_PAGE_SIZE);
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, status]);

  const trackerByKey = useMemo(() => {
    const map = new Map<string, DocumentUploadItem>();
    for (const item of items) {
      if (item.storageKey) map.set(item.storageKey, item);
    }
    return map;
  }, [items]);

  useEffect(() => {
    for (const doc of results) {
      if (doc.status !== "Uploading") continue;
      if (trackerByKey.has(doc.storageKey)) continue;
      resumeStaleUpload({
        _id: doc._id,
        storageKey: doc.storageKey,
        name: doc.name,
        type: doc.type,
        size: doc.size,
      });
    }
  }, [results, resumeStaleUpload, trackerByKey]);

  const rowKeys = useMemo(
    () => new Set(results.map((doc) => doc.storageKey)),
    [results],
  );

  const unmatchedTrackerItems = useMemo(
    () =>
      items.filter(
        (item) => item.storageKey === null || !rowKeys.has(item.storageKey),
      ),
    [items, rowKeys],
  );

  if (status === "LoadingFirstPage") {
    return <DocumentGridSkeleton />;
  }

  const hasSearch = shownTerm.trim().length > 0;
  const hasActiveFilters = activeDocumentFilterCount(filters) > 0;
  const isEmpty = results.length === 0 && unmatchedTrackerItems.length === 0;

  return (
    <>
      {isEmpty ? (
        hasSearch ? (
          <div className="mt-8 rounded-[9px] border border-dashed border-[#dedee3] px-6 py-6 text-xs font-medium text-text-dim">
            No documents match &quot;{shownTerm.trim()}&quot;
          </div>
        ) : (
          <DocumentEmptyState hasActiveFilters={hasActiveFilters} />
        )
      ) : (
        <ul
          aria-label="Documents"
          className="mt-8 grid list-none justify-between grid-cols-[repeat(auto-fill,10rem)] gap-x-3 gap-y-6 p-0"
        >
          {unmatchedTrackerItems.map((item) => (
            <li key={item.id} className="w-40">
              <TrackerTile item={item} />
            </li>
          ))}
          {results.map((doc) => (
            <li key={doc._id} className="w-40">
              <DocumentTile
                doc={doc}
                tracker={trackerByKey.get(doc.storageKey)}
                onPreview={setPreviewDoc}
              />
            </li>
          ))}
        </ul>
      )}

      {status === "LoadingMore" ? (
        <div className="mt-4 text-xs font-medium text-[#a0a2a8]">Loading…</div>
      ) : null}

      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <PreviewModal
        storageKey={previewDoc?.storageKey ?? null}
        filename={previewDoc?.name ?? ""}
        mediaType={previewDoc?.type}
        onClose={() => setPreviewDoc(null)}
      />
    </>
  );
}
