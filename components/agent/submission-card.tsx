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
  draft: { label: "Draft", className: "bg-[#f4f4f5] text-[#5b5d65]" },
  preparing: { label: "Preparing…", className: "bg-[#eef1fd] text-[#555fc9]" },
  awaiting_review: { label: "Awaiting review", className: "bg-[#fef6e7] text-[#b57508]" },
  login_failed: { label: "Login failed", className: "bg-[#fdecec] text-[#b42318]" },
  submitting: { label: "Uploading…", className: "bg-[#eef1fd] text-[#555fc9]" },
  done: { label: "Submitted", className: "bg-[#e9f7ec] text-[#2f7a3d]" },
  failed: { label: "Failed", className: "bg-[#fdecec] text-[#b42318]" },
  cancelled: { label: "Cancelled", className: "bg-[#f4f4f5] text-[#85878e]" },
};

export function SubmissionCard({ submissionId }: { submissionId: string }) {
  const submission = useQuery(api.submissions.getSubmission, {
    submissionId: submissionId as Id<"submissions">,
  });
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const { prefill } = useComposerPrefill();

  if (submission === undefined) {
    return (
      <div className="h-[120px] animate-pulse rounded-[12px] border border-[#e7e7e9] bg-white" />
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
    <div className="rounded-[12px] border border-[#e7e7e9] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.035)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[#292a30]">
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
        <div className="mt-1.5 truncate text-[12px] leading-[16px] text-[#777a82]">
          {filledName}
        </div>
      )}

      {submission.mappings.length > 0 && (
        <div className="mt-2 text-[12px] leading-[16px] text-[#5d5f66]">
          {scored.length}/{submission.mappings.length} students scored
          {needsReview.length > 0
            ? ` · ${needsReview.length} need attention`
            : " · complete"}
        </div>
      )}

      {submission.error && (
        <div className="mt-2 rounded-[8px] bg-[#fdecec] px-2.5 py-1.5 text-[12px] leading-[16px] text-[#b42318]">
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[#45474e] transition-colors hover:bg-[#f4f4f5]"
            >
              <Eye aria-hidden="true" className="size-3.5" strokeWidth={2} />
              Preview
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`Edit ${filledName}`}
            onClick={handleEdit}
            className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[#45474e] transition-colors hover:bg-[#f4f4f5]"
          >
            <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2} />
            Edit
          </button>
          <button
            type="button"
            aria-label={`Download ${filledName}`}
            onClick={handleDownload}
            className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[#45474e] transition-colors hover:bg-[#f4f4f5]"
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
