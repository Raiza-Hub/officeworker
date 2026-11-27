import { describe, expect, test } from "vitest";
import { buildEditToggle } from "../components/agent/preview-modal/preview-actions-utils";
import {
  canEditPreviewRow,
  fileCountLabel,
  fileEditPrefixForName,
  shouldOpenPreviewOnKeyDown,
  submissionToRow,
} from "../lib/submission-card";
import type { Doc } from "../convex/_generated/dataModel";

const noop = () => undefined;

function submission(overrides: Partial<Doc<"submissions">> = {}): Doc<"submissions"> {
  return {
    _id: "submission-1" as Doc<"submissions">["_id"],
    _creationTime: 1,
    userId: "user-1" as Doc<"submissions">["userId"],
    threadId: "thread-1",
    goal: "Submit the form",
    status: "awaiting_review",
    edits: [],
    error: undefined,
    browserJob: undefined,
    files: {
      inputs: [],
      outputs: [],
      uploadCandidate: { key: "candidate-key", name: "candidate.xlsx" },
    },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as Doc<"submissions">;
}

describe("submission card pure seams", () => {
  test("maps an awaiting submission to its filename and storage key", () => {
    expect(submissionToRow(submission())).toEqual({
      id: "submission-1",
      submissionId: "submission-1",
      name: "candidate.xlsx",
      status: "awaiting_review",
      storageKey: "candidate-key",
      error: null,
    });
  });

  test("does not fall back to the goal when no file exists", () => {
    const result = submissionToRow(
      submission({
        files: { inputs: [], outputs: [] },
      }),
    );
    expect(result).toBeNull();
  });

  test("excludes cancelled submissions", () => {
    expect(submissionToRow(submission({ status: "cancelled" }))).toBeNull();
  });

  test("ignores Enter or Space pressed on a nested action button", () => {
    expect(
      shouldOpenPreviewOnKeyDown({
        key: "Enter",
        target: { tagName: "BUTTON" },
        currentTarget: { tagName: "DIV" },
      }),
    ).toBe(false);
  });

  test("opens preview for Enter on the row itself", () => {
    expect(
      shouldOpenPreviewOnKeyDown({
        key: "Enter",
        target: { tagName: "DIV" },
        currentTarget: { tagName: "DIV" },
      }),
    ).toBe(true);
  });
});

describe("file edit notice seam", () => {
  test("builds the notice prefix without writing it into the composer", () => {
    expect(fileEditPrefixForName("report.xlsx")).toBe("@report.xlsx ");
  });
});

describe("file count header seam", () => {
  test("formats the visible file count", () => {
    expect(fileCountLabel(0)).toBe("Files (0)");
    expect(fileCountLabel(1)).toBe("Files (1)");
    expect(fileCountLabel(7)).toBe("Files (7)");
    expect(fileCountLabel(12)).toBe("Files (12)");
  });
});

describe("preview editability seam", () => {
  const base = {
    csvSaveApi: null,
    xlsxSaveApi: null,
    isContentLoading: false,
    csvEditable: false,
    xlsxEditable: false,
    docxEditable: false,
    pptxEditable: false,
    onToggleCsv: noop,
    onToggleXlsx: noop,
    onToggleDocx: noop,
    onTogglePptx: noop,
  };

  test("blocks preview editing only while the browser job is running", () => {
    const row = (status: "preparing" | "submitting" | "awaiting_review" | "done" | "failed" | "login_failed" | "cancelled") => ({
      id: `row-${status}`,
      name: "candidate.xlsx",
      status,
    });

    expect(canEditPreviewRow(row("preparing"))).toBe(false);
    expect(canEditPreviewRow(row("submitting"))).toBe(false);
    expect(canEditPreviewRow(row("awaiting_review"))).toBe(true);
    expect(canEditPreviewRow(row("done"))).toBe(true);
    expect(canEditPreviewRow(row("failed"))).toBe(true);
    expect(canEditPreviewRow(row("login_failed"))).toBe(true);
    expect(canEditPreviewRow(row("cancelled"))).toBe(true);
    expect(canEditPreviewRow(null)).toBe(false);
  });

  test("hides edit toggle when editing is not allowed", () => {
    expect(
      buildEditToggle({ ...base, kind: "docx", allowEdit: false }),
    ).toBeNull();
    expect(
      buildEditToggle({ ...base, kind: "pptx", allowEdit: false }),
    ).toBeNull();
  });

  test("keeps edit toggle when editing is allowed", () => {
    expect(buildEditToggle({ ...base, kind: "docx" })).toEqual({
      editable: false,
      toggle: noop,
    });
  });
});
