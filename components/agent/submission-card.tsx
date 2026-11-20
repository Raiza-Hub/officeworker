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
  awaiting_scores: { label: "Awaiting scores", className: "bg-[#eef1fd] text-primary-hover" },
  awaiting_review: { label: "Awaiting review", className: "bg-[#fef6e7] text-[#b57508]" },
  login_failed: { label: "Login failed", className: "bg-danger-bg text-danger-text" },
  submitting: { label: "Uploading…", className: "bg-[#eef1fd] text-primary-hover" },
  done: { label: "Submitted", className: "bg-[#e9f7ec] text-[#2f7a3d]" },
  failed: { label: "Failed", className: "bg-danger-bg text-danger-text" },
  cancelled: { label: "Cancelled", className: "bg-surface-hover text-muted-foreground" },
};

type Edit = { cell: string; value: string | number | null };

function EditSummary({
  edits,
  needsReview,
  showReviewNotice,
}: {
  edits: Edit[];
  needsReview: boolean;
  showReviewNotice: boolean;
}) {
  if (edits.length === 0) {
    return showReviewNotice ? (
      <div className="mt-2 text-xs leading-4 text-[#b57508]">
        Needs your review before upload.
      </div>
    ) : null;
  }
  return (
    <div className="mt-2 space-y-1 text-xs leading-4 text-[#5d5f66]">
      <div>
        {edits.length} cell edit{edits.length === 1 ? "" : "s"} applied
        {needsReview ? " · needs your review before upload" : ""}
      </div>
      <div className="truncate text-[11px] text-text-tertiary">
        {edits
          .slice(0, 6)
          .map((edit) => `${edit.cell}: ${edit.value ?? "—"}`)
          .join(", ")}
        {edits.length > 6 ? `, +${edits.length - 6} more` : ""}
      </div>
    </div>
  );
}

function FileActions({
  filledName,
  onPreview,
  onEdit,
  onDownload,
}: {
  filledName: string;
  onPreview: () => void;
  onEdit: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {isPreviewSupported(filledName) ? (
        <button
          type="button"
          aria-label={`Preview ${filledName}`}
          onClick={onPreview}
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
        >
          <Eye aria-hidden="true" className="size-3.5" strokeWidth={2} />
          Preview
        </button>
      ) : null}
      <button
        type="button"
        aria-label={`Download ${filledName}`}
        onClick={onDownload}
        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <Download aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Download
      </button>
      <button
        type="button"
        aria-label={`Edit ${filledName}`}
        onClick={onEdit}
        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Edit
      </button>
    </div>
  );
}

function JobInfo({ job }: { job: any }) {
  if (!job) return null;
  const parts = [
    job.intent ? `job: ${job.intent}` : null,
    job.status ? `status: ${job.status}` : null,
    job.phase ? `phase: ${job.phase}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (!parts) return null;
  return <div className="mt-2 text-[11px] leading-4 text-text-tertiary">{parts}</div>;
}

export function SubmissionCard({ submissionId }: { submissionId: string }) {
  const submission = useQuery(api.submissions.getSubmission, {
    submissionId: submissionId as Id<"submissions">,
  });
  const { prefill } = useComposerPrefill();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (submission === null) return null;
  if (submission === undefined) {
    return (
      <div className="mt-3 h-16 w-full max-w-sm animate-pulse rounded-xl bg-surface-hover" />
    );
  }

  const style = statusStyles[submission.status] ?? statusStyles.draft;
  const edits = ((submission as any).edits ?? []) as Edit[];
  const needsReview = Boolean((submission as any).needsReview);
  const filledName = submission.files.filled?.originalName;
  const filledKey = submission.files.filled?.key ?? null;
  const job = (submission as any).browserJob ?? null;

  const handleEdit = () => {
    const name = filledName ?? submission.files.template?.originalName ?? "filled sheet";
    const message = `Edit ${name}: `;
    prefill(message, message.length);
  };

  const handlePreview = () => {
    if (!filledKey || !filledName) return;
    setIsPreviewOpen(true);
  };

  const handleDownload = async () => {
    if (!filledKey || !filledName) return;
    try {
      const url = await fetchDownloadUrl(filledKey);
      await downloadFileUrl(url, filledName);
    } catch {
      toast.error("Download failed", { description: "Please try again." });
    }
  };

  return (
    <div className="mt-3 w-full max-w-sm rounded-xl border border-border-subtle bg-surface-raised px-3.5 py-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {submission.subject}
          </div>
          <div className="mt-0.5 truncate text-xs text-text-secondary">
            {submission.className} · {submission.term} · {submission.academicYear}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.className}`}
        >
          {style.label}
        </span>
      </div>

      <JobInfo job={job} />

      <EditSummary
        edits={edits}
        needsReview={needsReview}
        showReviewNotice={submission.status === "awaiting_review"}
      />

      {filledName && filledKey ? (
        <FileActions
          filledName={filledName}
          onPreview={handlePreview}
          onEdit={handleEdit}
          onDownload={handleDownload}
        />
      ) : null}

      {filledName && filledKey ? (
        <PreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          storageKey={filledKey}
          name={filledName}
        />
      ) : null}

      {submission.error ? (
        <div className="mt-2 text-xs leading-4 text-danger-text">
          {submission.error}
        </div>
      ) : null}
    </div>
  );
}
TS
