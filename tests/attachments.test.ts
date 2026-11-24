import { describe, expect, test } from "bun:test";
import { isSpreadsheetAttachment } from "../lib/attachments";

describe("isSpreadsheetAttachment", () => {
  test("detects spreadsheet file extensions", () => {
    expect(
      isSpreadsheetAttachment({
        name: "budget.xlsx",
        mediaType: "application/octet-stream",
      }),
    ).toBe(true);
    expect(
      isSpreadsheetAttachment({
        name: "budget.xls",
        mediaType: "application/octet-stream",
      }),
    ).toBe(true);
    expect(
      isSpreadsheetAttachment({
        name: "budget.csv",
        mediaType: "application/octet-stream",
      }),
    ).toBe(true);
    expect(
      isSpreadsheetAttachment({
        name: "budget.tsv",
        mediaType: "application/octet-stream",
      }),
    ).toBe(true);
  });

  test("detects spreadsheet media types", () => {
    expect(
      isSpreadsheetAttachment({
        name: "download",
        mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).toBe(true);
    expect(
      isSpreadsheetAttachment({ name: "download", mediaType: "text/csv" }),
    ).toBe(true);
    expect(
      isSpreadsheetAttachment({
        name: "download",
        mediaType: "text/tab-separated-values",
      }),
    ).toBe(true);
  });

  test("rejects non-spreadsheet attachments", () => {
    expect(
      isSpreadsheetAttachment({
        name: "report.pdf",
        mediaType: "application/pdf",
      }),
    ).toBe(false);
    expect(
      isSpreadsheetAttachment({
        name: "notes.txt",
        mediaType: "text/plain",
      }),
    ).toBe(false);
    expect(
      isSpreadsheetAttachment({
        name: "photo.png",
        mediaType: "image/png",
      }),
    ).toBe(false);
  });
});
