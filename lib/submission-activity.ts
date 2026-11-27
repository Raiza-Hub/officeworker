export type SubmissionActivityCounts = {
  visibleCount: number;
  awaitingCount: number;
  hasAwaitingReview: boolean;
};

export function activityForStatus(status: string): SubmissionActivityCounts {
  const visible = status !== "cancelled";
  const awaiting = status === "awaiting_review";
  return {
    visibleCount: visible ? 1 : 0,
    awaitingCount: awaiting ? 1 : 0,
    hasAwaitingReview: awaiting,
  };
}

export function addSubmissionActivity(
  previous: SubmissionActivityCounts,
  status: string,
): SubmissionActivityCounts {
  const added = activityForStatus(status);
  const awaitingCount = previous.awaitingCount + added.awaitingCount;
  return {
    visibleCount: previous.visibleCount + added.visibleCount,
    awaitingCount,
    hasAwaitingReview: awaitingCount > 0,
  };
}

export function activityFromSubmissions(
  submissions: Iterable<{ status: string }>,
): SubmissionActivityCounts {
  let visibleCount = 0;
  let awaitingCount = 0;
  for (const submission of submissions) {
    const counts = activityForStatus(submission.status);
    visibleCount += counts.visibleCount;
    awaitingCount += counts.awaitingCount;
  }
  return {
    visibleCount,
    awaitingCount,
    hasAwaitingReview: awaitingCount > 0,
  };
}

export function applyActivityTransition(
  previous: SubmissionActivityCounts,
  previousStatus: string,
  nextStatus: string,
): SubmissionActivityCounts {
  if (previousStatus === nextStatus) return previous;
  const before = activityForStatus(previousStatus);
  const after = activityForStatus(nextStatus);
  const awaitingCount =
    previous.awaitingCount - before.awaitingCount + after.awaitingCount;
  return {
    visibleCount: Math.max(
      0,
      previous.visibleCount - before.visibleCount + after.visibleCount,
    ),
    awaitingCount: Math.max(0, awaitingCount),
    hasAwaitingReview: awaitingCount > 0,
  };
}
