"use client";

import {
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { useAction } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { usePaginatedQuery } from "convex-helpers/react/cache/hooks";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useComposerPrefill } from "@/components/agent/composer-context";
import { SubmissionCardView } from "@/components/agent/submission-card-view";
import {
  submissionToRow,
  type SubmissionCardRow,
} from "@/lib/submission-card";

function addId(current: Set<string>, id: string) {
  const next = new Set(current);
  next.add(id);
  return next;
}

function removeId(current: Set<string>, id: string) {
  const next = new Set(current);
  next.delete(id);
  return next;
}

const PAGE_SIZE = 20;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function addPending(
  ref: RefObject<Set<string>>,
  setPendingIds: Dispatch<SetStateAction<Set<string>>>,
  id: string,
) {
  ref.current.add(id);
  setPendingIds((current) => addId(current, id));
}

function removePending(
  ref: RefObject<Set<string>>,
  setPendingIds: Dispatch<SetStateAction<Set<string>>>,
  id: string,
) {
  ref.current.delete(id);
  setPendingIds((current) => removeId(current, id));
}

export function ThreadSubmissionCard({ threadId }: { threadId: string }) {
  const { results: submissions, status, loadMore } = usePaginatedQuery(
    api.submissions.listThreadSubmissions,
    { threadId },
    { initialNumItems: PAGE_SIZE },
  );
  const activity = useQuery(api.submissions.getThreadActivity, { threadId });
  const approve = useAction(api.submissions.approveForUpload);
  const cancel = useAction(api.submissions.cancelForUser);
  const { startFileEdit } = useComposerPrefill();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const rows: SubmissionCardRow[] = submissions.flatMap((submission) => {
    if (hiddenIds.has(submission._id)) return [];
    const row = submissionToRow(submission);
    return row ? [row] : [];
  });
  const pendingRowIds = new Set(
    submissions
      .filter((submission) => pendingIds.has(submission._id))
      .map((submission) => submission._id),
  );

  if (rows.length === 0) return null;

  async function handleProceed(row: SubmissionCardRow) {
    const submissionId = row.submissionId as Id<"submissions"> | undefined;
    if (!submissionId || pendingIdsRef.current.has(submissionId)) return;
    addPending(pendingIdsRef, setPendingIds, submissionId);
    try {
      await approve({ submissionId });
      toast.success(`Approved ${row.name}`);
    } catch (error) {
      toast.error("Approval failed", {
        description: errorMessage(error, "Please try again."),
      });
    } finally {
      removePending(pendingIdsRef, setPendingIds, submissionId);
    }
  }

  async function handleCancel(row: SubmissionCardRow) {
    const submissionId = row.submissionId as Id<"submissions"> | undefined;
    if (!submissionId || pendingIdsRef.current.has(submissionId)) return;
    setHiddenIds((current) => addId(current, submissionId));
    addPending(pendingIdsRef, setPendingIds, submissionId);
    try {
      await cancel({ submissionId });
      toast.info(`Cancelled ${row.name}`);
    } catch (error) {
      setHiddenIds((current) => removeId(current, submissionId));
      toast.error("Cancel failed", {
        description: errorMessage(error, "Please try again."),
      });
    } finally {
      removePending(pendingIdsRef, setPendingIds, submissionId);
    }
  }

  return (
    <>
      <SubmissionCardView
        rows={rows}
        fileCount={activity?.visibleCount ?? rows.length}
        pendingRowIds={pendingRowIds}
        onProceed={(row) => void handleProceed(row)}
        onEdit={(row) => startFileEdit(row.name)}
        onCancel={(row) => void handleCancel(row)}
      />
      {status === "CanLoadMore" && (
        <button
          type="button"
          onClick={() => loadMore(PAGE_SIZE)}
          className="mt-2 inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs leading-none font-medium text-ink-soft transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Load more files
        </button>
      )}
      {status === "LoadingMore" && (
        <LoaderCircle
          aria-label="Loading more files"
          className="mt-2 size-3.5 animate-spin text-text-tertiary"
          strokeWidth={2}
        />
      )}
    </>
  );
}
