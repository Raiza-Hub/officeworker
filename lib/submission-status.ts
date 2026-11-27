export type SubmissionStatus =
  | "preparing"
  | "awaiting_review"
  | "login_failed"
  | "submitting"
  | "done"
  | "failed"
  | "cancelled";

export function canApproveSubmission(status: string) {
  return status === "awaiting_review";
}

export function canCancelSubmission(status: string) {
  return status !== "done" && status !== "cancelled";
}

export function shouldRevertApprovalClaim(
  status: string,
  browserJob?: { runId?: string } | null,
) {
  return status === "submitting" && !browserJob?.runId;
}

export function shouldRevertCancelClaim(status: string) {
  return status === "cancelled";
}
