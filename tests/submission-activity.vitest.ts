import { describe, expect, test } from "vitest";
import {
  activityForStatus,
  activityFromSubmissions,
  addSubmissionActivity,
  applyActivityTransition,
} from "../lib/submission-activity";

describe("submission thread activity", () => {
  test("builds counts from one submission status", () => {
    expect(activityForStatus("awaiting_review")).toEqual({
      visibleCount: 1,
      awaitingCount: 1,
      hasAwaitingReview: true,
    });
    expect(activityForStatus("submitting")).toEqual({
      visibleCount: 1,
      awaitingCount: 0,
      hasAwaitingReview: false,
    });
    expect(activityForStatus("cancelled")).toEqual({
      visibleCount: 0,
      awaitingCount: 0,
      hasAwaitingReview: false,
    });
  });

  test("applies a visible submission status transition", () => {
    expect(
      applyActivityTransition(
        { visibleCount: 2, awaitingCount: 1, hasAwaitingReview: true },
        "awaiting_review",
        "submitting",
      ),
    ).toEqual({
      visibleCount: 2,
      awaitingCount: 0,
      hasAwaitingReview: false,
    });
  });

  test("restores counts when a cancelled submission becomes visible", () => {
    expect(
      applyActivityTransition(
        { visibleCount: 1, awaitingCount: 0, hasAwaitingReview: false },
        "cancelled",
        "awaiting_review",
      ),
    ).toEqual({
      visibleCount: 2,
      awaitingCount: 1,
      hasAwaitingReview: true,
    });
  });

  test("adds a new submission without replacing existing counts", () => {
    expect(
      addSubmissionActivity(
        { visibleCount: 2, awaitingCount: 1, hasAwaitingReview: true },
        "preparing",
      ),
    ).toEqual({
      visibleCount: 3,
      awaitingCount: 1,
      hasAwaitingReview: true,
    });
    expect(
      addSubmissionActivity(
        { visibleCount: 2, awaitingCount: 1, hasAwaitingReview: true },
        "cancelled",
      ),
    ).toEqual({
      visibleCount: 2,
      awaitingCount: 1,
      hasAwaitingReview: true,
    });
    expect(
      addSubmissionActivity(
        { visibleCount: 2, awaitingCount: 0, hasAwaitingReview: false },
        "awaiting_review",
      ),
    ).toEqual({
      visibleCount: 3,
      awaitingCount: 1,
      hasAwaitingReview: true,
    });
  });

  test("builds aggregate counts from multiple submissions", () => {
    expect(
      activityFromSubmissions([
        { status: "awaiting_review" },
        { status: "preparing" },
        { status: "submitting" },
        { status: "done" },
        { status: "cancelled" },
      ]),
    ).toEqual({
      visibleCount: 4,
      awaitingCount: 1,
      hasAwaitingReview: true,
    });
  });
});
