import { describe, expect, test } from "bun:test";
import {
  formatInvoiceAmount,
  formatInvoiceAmountAscii,
  formatInvoiceDate,
  formatTransactionDate,
  formatTransactionDateTime,
  getInvoiceFileName,
  getInvoicePlanLabel,
} from "../lib/invoice";
import { buildInvoicePdfBytes } from "../lib/invoice-pdf";

describe("invoice helpers", () => {
  test("maps wallet plans to display labels", () => {
    expect(getInvoicePlanLabel("pro")).toBe("Pro");
    expect(getInvoicePlanLabel("basic")).toBe("Basic");
    expect(getInvoicePlanLabel(undefined)).toBe("Basic");
  });

  test("formats invoice dates with the app UTC offset", () => {
    expect(formatInvoiceDate(Date.UTC(2026, 10, 23, 23, 30))).toBe("24 Nov 2026");
  });

  test("formats transaction dates as M/D/YYYY", () => {
    expect(formatTransactionDate(Date.UTC(2026, 3, 20, 12, 0))).toBe("4/20/2026");
    expect(formatTransactionDateTime(Date.UTC(2026, 3, 20, 12, 0))).toBe(
      "2026-04-20T12:00:00.000Z",
    );
  });

  test("handles invalid transaction dates", () => {
    expect(formatTransactionDate(Number.NaN)).toBe("—");
    expect(formatTransactionDateTime(Number.NaN)).toBe(undefined);
  });

  test("formats naira amounts for the UI and PDF", () => {
    expect(formatInvoiceAmount(5000).includes("5,000")).toBe(true);
    expect(formatInvoiceAmountAscii(5000)).toBe("NGN 5,000.00");
    expect(formatInvoiceAmountAscii(0)).toBe("NGN 0.00");
  });

  test("builds the invoice filename from the reference", () => {
    expect(getInvoiceFileName("OW-123")).toBe("invoice-OW-123.pdf");
  });

  test("builds a PDF document", async () => {
    const bytes = await buildInvoicePdfBytes({
      reference: "OW-123",
      amount: 5000,
      date: Date.UTC(2026, 10, 23, 23, 30),
      plan: "Basic",
    });
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));
    expect(header).toBe("%PDF-");
  });
});
