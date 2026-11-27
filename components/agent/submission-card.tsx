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
  preparing: { label: "Preparing…", className: "bg-[#eef1fd] text-primary-hover" },
  awaiting_review: { label: "Awaiting review", className: "bg-[#fef6e7] text-[#b57508]" },
  login_failed: { label: "Login failed", className: "bg-danger-bg text-danger-text" },
  submitting: { label: "Uploading…", className: "bg-[#eef1fd] text-primary-hover" },
  done: { label: "Completed", className: "bg-[#e9f7ec] text-[#2f7a3d]" },
  failed: { label: "Failed", className: "bg-danger-bg text-danger-text" },
  cancelled: { label: "Cancelled", className: "bg-surface-hover text-muted-foreground" },
};

type Artifact = { key: string; name: string; size?: number; sourcePath?: string };
type Edit = { cell: string; value: string | number | null };

function EditSummary({ edits }: { edits: Edit[] }) {
  if (edits.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 text-xs leading-4 text-[#5d5f66]">
      <div>{edits.length} cell edit{edits.length === 1 ? "" : "s"} applied</div>
      <div className="truncate text-[11px] text-text-tertiary">
        {edits.slice(0, 6).map((edit) => `${edit.cell}: ${edit.value ?? "—"}`).join(", ")}
        {edits.length > 6 ? `, +${edits.length - 6} more` : ""}
      </div>
    </div>
  );
}

function FileActions({
  fileName,
  onPreview,
  onEdit,
  onDownload,
}: {
  fileName: string;
  onPreview: () => void;
  onEdit: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {isPreviewSupported(fileName) ? (
        <button
          type="button"
          aria-label={`Preview ${fileName}`}
          onClick={onPreview}
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
        >
          <Eye aria-hidden="true" className="size-3.5" strokeWidth={2} />
          Preview
        </button>
      ) : null}
      <button
        type="button"
        aria-label={`Download ${fileName}`}
        onClick={onDownload}
        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <Download aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Download
      </button>
      <button
        type="button"
        aria-label={`Edit ${fileName}`}
        onClick={onEdit}
        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Edit
      </button>
    </div>
  );
}

function JobInfo({ job }: { job: { intent?: string; status?: string; phase?: string } | null }) {
  if (!job) return null;
  const parts = [
    job.intent ? `job: ${job.intent}` : null,
    job.status ? `status: ${job.status}` : null,
    job.phase ? `phase: ${job.phase}` : null,
  ].filter(Boolean).join(" · ");
  if (!parts) return null;
  return <div className="mt-2 text-[11px] leading-4 text-text-tertiary">{parts}</div>;
}

export function SubmissionCard({ submissionId }: { submissionId: string }) {
  const submission = useQuery(api.submissions.getSubmission, {
    submissionId: submissionId as Id<"submissions">,
  });
  const { prefill } = useComposerPrefill();
  const [preview, setPreview] = useState<{ key: string; name: string } | null>(null);

  if (submission === null) return null;
  if (submission === undefined) {
    return <div className="mt-3 h-16 w-full max-w-sm animate-pulse rounded-xl bg-surface-hover" />;
  }

  const style = statusStyles[submission.status] ?? statusStyles.preparing;
  const edits = ((submission as { edits?: Edit[] }).edits ?? []) as Edit[];
  const outputs = ((((submission as { files?: { outputs?: Artifact[] } }).files?.outputs ?? []) as Artifact[])).slice(0, 3);
  const candidate = (((submission as { files?: { uploadCandidate?: Artifact | null } }).files?.uploadCandidate ?? null) as Artifact | null);
  const job = ((submission as { browserJob?: { intent?: string; status?: string; phase?: string } | null }).browserJob ?? null);

  const handleEdit = (file: Artifact) => {
    const message = `Edit ${file.name} (key: ${file.key}): `;
    prefill(message, { highlight: true });
  };

  const handleDownload = async (file: Artifact) => {
    try {
      const { url } = await fetchDownloadUrl(file.key);
      await downloadFileUrl(url, file.name);
    } catch {
      toast.error("Download failed", { description: "Please try again." });
    }
  };

  return (
    <div className="mt-3 w-full max-w-sm rounded-xl border border-border-subtle bg-surface-raised px-3.5 py-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">Portal job</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{(submission as { goal: string }).goal}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.className}`}>
          {style.label}
        </span>
      </div>

      <JobInfo job={job} />
      <EditSummary edits={edits} />

      {candidate ? (
        <div className="mt-3 border-t border-border-subtle pt-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Upload candidate</div>
          <div className="mt-1 truncate text-xs text-text-secondary">{candidate.name}</div>
          {submission.status === "awaiting_review" ? (
            <div className="mt-1 text-xs leading-4 text-[#b57508]">
              Review it and explicitly approve before upload.
            </div>
          ) : null}
          <FileActions
            fileName={candidate.name}
            onPreview={() => setPreview({ key: candidate.key, name: candidate.name })}
            onEdit={() => handleEdit(candidate)}
            onDownload={() => void handleDownload(candidate)}
          />
        </div>
      ) : null}

      {!candidate && outputs.length > 0 ? (
        <div className="mt-3 border-t border-border-subtle pt-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Outputs</div>
          <ul className="mt-1 space-y-1">
            {outputs.map((file) => (
              <li key={file.key} className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => void handleDownload(file)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-text-secondary hover:bg-surface-hover"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {submission.error ? (
        <div className="mt-2 text-xs leading-4 text-danger-text">{submission.error}</div>
      ) : null}

      <PreviewModal
        storageKey={preview?.key ?? null}
        filename={preview?.name ?? ""}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
