import { downloadBlob } from "@/lib/download";
import {
  formatInvoiceAmountAscii,
  formatInvoiceDate,
  getInvoiceFileName,
  type InvoiceData,
} from "@/lib/invoice";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const REVOKE_DELAY_MS = 60_000;

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function buildInvoicePdfBytes(invoice: InvoiceData): Promise<ArrayBuffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const [regularFont, boldFont] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  const margin = 56;
  const ink = rgb(0.11, 0.12, 0.15);
  const muted = rgb(0.42, 0.44, 0.49);
  const divider = rgb(0.88, 0.89, 0.91);

  let y = PAGE_HEIGHT - 88;

  page.drawText("Officeworker", {
    color: ink,
    font: boldFont,
    size: 18,
    x: margin,
    y,
  });

  const heading = "INVOICE";
  const headingWidth = boldFont.widthOfTextAtSize(heading, 10);
  page.drawText(heading, {
    color: muted,
    font: boldFont,
    size: 10,
    x: PAGE_WIDTH - margin - headingWidth,
    y,
  });

  y -= 16;
  page.drawRectangle({
    color: divider,
    height: 1,
    width: PAGE_WIDTH - margin * 2,
    x: margin,
    y: y - 8,
  });

  y -= 48;
  page.drawText("Payment receipt", {
    color: ink,
    font: boldFont,
    size: 12,
    x: margin,
    y,
  });

  y -= 36;
  const rows: Array<[string, string]> = [
    ["Invoice number", invoice.reference],
    ["Plan", invoice.plan],
    ["Amount", formatInvoiceAmountAscii(invoice.amount)],
    ["Date", formatInvoiceDate(invoice.date)],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, {
      color: muted,
      font: regularFont,
      size: 10,
      x: margin,
      y,
    });

    const valueWidth = boldFont.widthOfTextAtSize(value, 11);
    page.drawText(value, {
      color: ink,
      font: boldFont,
      size: 11,
      x: PAGE_WIDTH - margin - valueWidth,
      y,
    });
    y -= 28;
  }

  y -= 12;
  page.drawRectangle({
    color: divider,
    height: 1,
    width: PAGE_WIDTH - margin * 2,
    x: margin,
    y,
  });

  y -= 32;
  page.drawText("Thank you for your payment.", {
    color: muted,
    font: regularFont,
    size: 11,
    x: margin,
    y,
  });

  return toArrayBuffer(await pdf.save());
}

export async function downloadInvoicePdf(invoice: InvoiceData) {
  const bytes = await buildInvoicePdfBytes(invoice);
  downloadBlob(bytes, getInvoiceFileName(invoice.reference), "application/pdf");
}

export async function openInvoicePdf(invoice: InvoiceData) {
  const nextWindow = window.open("", "_blank");
  if (nextWindow) {
    nextWindow.opener = null;
    nextWindow.document.write("Preparing invoice...");
    nextWindow.document.close();
  }

  try {
    const bytes = await buildInvoicePdfBytes(invoice);
    if (!nextWindow) {
      downloadBlob(bytes, getInvoiceFileName(invoice.reference), "application/pdf");
      return;
    }

    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    nextWindow.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  } catch (error) {
    nextWindow?.close();
    throw error;
  }
}
