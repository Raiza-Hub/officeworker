"use client";

import { useQuery } from "convex-helpers/react/cache";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Eye, Pencil } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PreviewModal } from "@/components/agent/preview-modal";
import { useComposerPrefill } from "@/components/agent/composer-context";
import { fetchDownloadUrl } from "@/components/agent/preview-url-cache";
import { downloadFileUrl } from "@/lib/download";
import { isPreviewSupported } from "@/lib/file-types";

const statusStyles: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface-hover text-[#5b5d65]" },
  preparing: { label: "Preparing…", className: "bg-[#eef1fd] text-primary-hover" },
  awaiting_review: { label: "Awaiting review", className: "bg-[#fef6e7] text-[#b57508]" },
  login_failed: { label: "Login failed", className: "bg-danger-bg text-danger-text" },
  submitting: { label: "Uploading…", className: "bg-[#eef1fd] text-primary-hover" },
  done: { label: "Submitted", className: "bg-[#e9f7ec] text-[#2f7a3d]" },
  failed: { label: "Failed", className: "bg-danger-bg text-danger-text" },
  cancelled: { label: "Cancelled", className: "bg-surface-hover text-muted-foreground" },
};

export function SubmissionCard({ submissionId }: { submissionId: string }) {
  const submission = useQuery(api.submissions.getSubmission, {
    submissionId: submissionId as Id<"submissions">,
  });
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const { prefill } = useComposerPrefill();

  if (submission === undefined) {
    return (
      <div className="h-30 animate-pulse rounded-xl border border-border bg-white" />
    );
  }
  if (submission === null) {
    return null;
  }

  const status = statusStyles[submission.status] ?? statusStyles.draft;
  const filledName = submission.files.filled?.originalName ?? null;
  const filledKey = submission.files.filled?.key ?? null;
  const needsReview = submission.mappings.filter((m) => m.needsReview);
  const scored = submission.mappings.filter(
    (m) => m.ca !== null || m.exam !== null,
  );

  async function handleDownload() {
    if (!filledKey) return;
    try {
      const { url, filename } = await fetchDownloadUrl(filledKey);
      downloadFileUrl(url, filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  }

  function handleEdit() {
    if (!filledName) return;
    prefill(`@${filledName} `);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-soft">
          {submission.subject} — {submission.className}, {submission.term}{" "}
          {submission.academicYear}
        </span>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] leading-none font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {filledName && (
        <div className="mt-1.5 truncate text-xs leading-4 text-text-tertiary">
          {filledName}
        </div>
      )}

      {submission.mappings.length > 0 && (
        <div className="mt-2 text-xs leading-4 text-[#5d5f66]">
          {scored.length}/{submission.mappings.length} students scored
          {needsReview.length > 0
            ? ` · ${needsReview.length} need attention`
            : " · complete"}
        </div>
      )}

      {submission.error && (
        <div className="mt-2 rounded-lg bg-danger-bg px-2.5 py-1.5 text-xs leading-4 text-danger-text">
          {submission.error}
        </div>
      )}

      {filledName && filledKey && (
        <div className="mt-3 flex items-center gap-1.5">
          {isPreviewSupported(filledName) ? (
            <button
              type="button"
              aria-label={`Preview ${filledName}`}
              onClick={() => setPreviewKey(filledKey)}
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            >
              <Eye aria-hidden="true" className="size-3.5" strokeWidth={2} />
              Preview
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`Edit ${filledName}`}
            onClick={handleEdit}
            className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2} />
            Edit
          </button>
          <button
            type="button"
            aria-label={`Download ${filledName}`}
            onClick={handleDownload}
            className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            <Download aria-hidden="true" className="size-3.5" strokeWidth={2} />
            Download
          </button>
        </div>
      )}

      <PreviewModal
        storageKey={previewKey}
        filename={filledName ?? "sheet.xlsx"}
        onClose={() => setPreviewKey(null)}
      />
    </div>
  );
}
