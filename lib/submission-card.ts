import type { Doc } from "@/convex/_generated/dataModel";

export type SubmissionCardRowStatus =
  | "awaiting_review"
  | "preparing"
  | "submitting"
  | "done"
  | "failed"
  | "login_failed"
  | "cancelled";

export type SubmissionCardRow = {
  id: string;
  name: string;
  status: SubmissionCardRowStatus;
  storageKey?: string | null;
  mediaType?: string;
  submissionId?: string;
  error?: string | null;
};

type SubmissionArtifact = { key: string; name: string };

export function submissionToRow(
  submission: Doc<"submissions">,
): SubmissionCardRow | null {
  if (submission.status === "cancelled") return null;
  const files = submission.files as {
    inputs?: SubmissionArtifact[];
    outputs?: SubmissionArtifact[];
    uploadCandidate?: SubmissionArtifact | null;
  };
  const file =
    files.uploadCandidate ??
    files.outputs?.[files.outputs.length - 1] ??
    files.inputs?.[files.inputs.length - 1];
  if (!file) return null;
  return {
    id: submission._id,
    submissionId: submission._id,
    name: file.name,
    status: submission.status as SubmissionCardRowStatus,
    storageKey: file.key,
    error: submission.error ?? null,
  };
}

export function fileEditPrefixForName(name: string) {
  return `@${name} `;
}

export function fileCountLabel(count: number) {
  return `Files (${count})`;
}

export function canEditPreviewRow(row: SubmissionCardRow | null) {
  if (row === null) return false;
  return row.status !== "preparing" && row.status !== "submitting";
}

function tagNameOf(target: unknown) {
  if (target === null || typeof target !== "object" || !("tagName" in target)) {
    return null;
  }
  return typeof target.tagName === "string" ? target.tagName : null;
}

export function shouldOpenPreviewOnKeyDown(event: {
  key: string;
  target: unknown;
  currentTarget: unknown;
}) {
  if (event.key !== "Enter" && event.key !== " ") return false;
  const targetTag = tagNameOf(event.target);
  return targetTag !== null && targetTag === tagNameOf(event.currentTarget);
}
