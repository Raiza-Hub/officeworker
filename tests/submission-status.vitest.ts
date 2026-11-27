import { describe, expect, test } from "vitest";
import {
  canApproveSubmission,
  canCancelSubmission,
  shouldRevertApprovalClaim,
  shouldRevertCancelClaim,
} from "../lib/submission-status";

describe("submission status policy", () => {
  test("only awaiting review can be approved", () => {
    expect(canApproveSubmission("awaiting_review")).toBe(true);
    expect(canApproveSubmission("submitting")).toBe(false);
    expect(canApproveSubmission("done")).toBe(false);
    expect(canApproveSubmission("cancelled")).toBe(false);
  });

  test("terminal submissions cannot be cancelled", () => {
    expect(canCancelSubmission("awaiting_review")).toBe(true);
    expect(canCancelSubmission("preparing")).toBe(true);
    expect(canCancelSubmission("done")).toBe(false);
    expect(canCancelSubmission("cancelled")).toBe(false);
  });

  test("approval failure reverts only a claimed submission without a live run", () => {
    expect(shouldRevertApprovalClaim("submitting")).toBe(true);
    expect(shouldRevertApprovalClaim("submitting", { runId: undefined })).toBe(true);
    expect(shouldRevertApprovalClaim("submitting", { runId: "run-1" })).toBe(false);
    expect(shouldRevertApprovalClaim("cancelled")).toBe(false);
    expect(shouldRevertApprovalClaim("awaiting_review")).toBe(false);
  });

  test("cancel failure reverts only a cancelled claim", () => {
    expect(shouldRevertCancelClaim("cancelled")).toBe(true);
    expect(shouldRevertCancelClaim("done")).toBe(false);
    expect(shouldRevertCancelClaim("submitting")).toBe(false);
  });
});
