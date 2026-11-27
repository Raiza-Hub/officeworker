"use client";

import { useId, useState } from "react";
import {
  AlertCircle,
  Ban,
  ChevronDown,
  CircleCheck,
  FileText,
  LoaderCircle,
  PencilLine,
} from "lucide-react";
import { PreviewModal } from "@/components/agent/preview-modal";
import {
  canEditPreviewRow,
  fileCountLabel,
  shouldOpenPreviewOnKeyDown,
  type SubmissionCardRow,
  type SubmissionCardRowStatus,
} from "@/lib/submission-card";

export type { SubmissionCardRow, SubmissionCardRowStatus };

type SubmissionCardViewProps = {
  rows: SubmissionCardRow[];
  fileCount?: number;
  onProceed?: (row: SubmissionCardRow) => void;
  onEdit?: (row: SubmissionCardRow) => void;
  onCancel?: (row: SubmissionCardRow) => void;
  pendingRowIds?: Set<string>;
};

const STATUS_LABELS: Record<SubmissionCardRowStatus, string> = {
  awaiting_review: "Awaiting approval",
  preparing: "Preparing",
  submitting: "Uploading",
  done: "Completed",
  failed: "Failed",
  login_failed: "Login failed",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<SubmissionCardRowStatus, string> = {
  awaiting_review: "text-blue-600",
  preparing: "text-text-tertiary",
  submitting: "text-amber-600",
  done: "text-emerald-600",
  failed: "text-danger-text",
  login_failed: "text-danger-text",
  cancelled: "text-text-tertiary",
};

export function SubmissionCardView({
  rows,
  fileCount,
  onProceed,
  onEdit,
  onCancel,
  pendingRowIds,
}: SubmissionCardViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewRowId, setPreviewRowId] = useState<string | null>(null);
  const rowsId = useId();
  const previewRow = rows.find((row) => row.id === previewRowId) ?? null;

  const visibleFileCount = fileCount ?? rows.length;

  if (rows.length === 0) return null;

  return (
    <div className="w-full rounded-xl bg-white px-3.5 py-3 text-left">
      <div
        className={`flex items-center gap-2 text-xs font-medium text-text-tertiary ${
          isExpanded ? "mb-2" : ""
        }`}
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={rowsId}
          aria-label={
            isExpanded ? "Collapse files list" : "Expand files list"
          }
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <FileText
            aria-hidden="true"
            className="size-3.5 shrink-0"
            strokeWidth={2.25}
          />
          <span>{fileCountLabel(visibleFileCount)}</span>
          <ChevronDown
            aria-hidden="true"
            className={`ml-auto size-3.5 shrink-0 transition-transform duration-200 ease-in-out ${
              isExpanded ? "rotate-180" : ""
            }`}
            strokeWidth={2}
          />
        </button>
      </div>

      <div
        id={rowsId}
        aria-hidden={!isExpanded}
        inert={!isExpanded}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col divide-y divide-border-soft">
            {rows.map((row) => {
              const canPreview = Boolean(row.storageKey);
              const pending = pendingRowIds?.has(row.id) ?? false;

              return (
                <div
                  key={row.id}
                  role={canPreview ? "button" : undefined}
                  tabIndex={canPreview ? 0 : undefined}
                  aria-label={
                    canPreview
                      ? `Preview ${row.name}, ${STATUS_LABELS[row.status]}`
                      : undefined
                  }
                  onClick={() => {
                    if (canPreview) setPreviewRowId(row.id);
                  }}
                  onKeyDown={(event) => {
                    if (!canPreview || !shouldOpenPreviewOnKeyDown(event)) return;
                    event.preventDefault();
                    setPreviewRowId(row.id);
                  }}
                  className={`group flex items-center justify-between gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    canPreview ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-[15.5px] font-medium tracking-normal text-sidebar-muted transition-colors group-hover:text-sidebar-foreground">
                      <FileText
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                        strokeWidth={2.25}
                      />
                      <span
                        className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
                        style={{
                          maskImage:
                            "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
                          WebkitMaskImage:
                            "linear-gradient(to right, black calc(100% - 24px), transparent 100%)",
                        }}
                      >
                        {row.name}
                      </span>
                    </div>
                    {row.error ? (
                      <span className="pl-5 text-[11px] leading-4 text-danger-text">
                        {row.error}
                      </span>
                    ) : null}
                  </div>

                  {row.status === "awaiting_review" &&
                  (onProceed || onEdit || onCancel) ? (
                    <div
                      className="flex shrink-0 items-center gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {onProceed ? (
                        <button
                          type="button"
                          aria-label={`Proceed ${row.name}`}
                          disabled={pending}
                          onClick={() => onProceed(row)}
                          className="inline-flex h-6 shrink-0 items-center rounded-full bg-primary px-2.5 text-[11px] leading-none font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Proceed
                        </button>
                      ) : null}
                      {onEdit ? (
                        <button
                          type="button"
                          aria-label={`Edit ${row.name}`}
                          title="Edit"
                          disabled={pending}
                          onClick={() => onEdit(row)}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-muted text-text-secondary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <PencilLine aria-hidden="true" className="size-3.5" strokeWidth={2} />
                        </button>
                      ) : null}
                      {onCancel ? (
                        <button
                          type="button"
                          aria-label={`Cancel ${row.name}`}
                          title="Cancel"
                          disabled={pending}
                          onClick={() => onCancel(row)}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-muted text-danger-text transition-colors hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Ban aria-hidden="true" className="size-3.5" strokeWidth={2} />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className="flex shrink-0 items-center gap-1.5 text-[11px] leading-none font-medium"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {row.status === "preparing" || row.status === "submitting" ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className={`size-3.5 animate-spin ${STATUS_STYLES[row.status]}`}
                          strokeWidth={2.25}
                        />
                      ) : row.status === "done" ? (
                        <CircleCheck
                          aria-hidden="true"
                          className={`size-3.5 ${STATUS_STYLES[row.status]}`}
                          strokeWidth={2.25}
                        />
                      ) : row.status === "cancelled" ? (
                        <Ban
                          aria-hidden="true"
                          className={`size-3.5 ${STATUS_STYLES[row.status]}`}
                          strokeWidth={2.25}
                        />
                      ) : (
                        <AlertCircle
                          aria-hidden="true"
                          className={`size-3.5 ${STATUS_STYLES[row.status]}`}
                          strokeWidth={2.25}
                        />
                      )}
                      <span className={STATUS_STYLES[row.status]}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <PreviewModal
        storageKey={previewRow?.storageKey ?? null}
        filename={previewRow?.name ?? ""}
        mediaType={previewRow?.mediaType}
        allowEdit={canEditPreviewRow(previewRow)}
        onClose={() => setPreviewRowId(null)}
      />
    </div>
  );
}
