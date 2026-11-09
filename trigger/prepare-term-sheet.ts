import { task, logger } from "@trigger.dev/sdk";
import Fuse from "fuse.js";
import ExcelJS from "exceljs";
import { generateObject } from "ai";
import { z } from "zod";
import {
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Browser, Page } from "puppeteer-core";
import {
  getAdapter,
  getSubmissionState,
  updateSubmission,
  withLightpanda,
  type PortalSession,
} from "./portal";
import { createR2Client, getR2Config } from "./r2";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

type Cookie = { name: string; value: string; domain: string; path: string };

type Payload = {
  submissionId: string;
  userId: string;
  portalKey: string;
  className: string;
  subject: string;
  term: string;
  academicYear: string;
  cookies: Cookie[];
  reuseTemplate: boolean;
};

type ExtractedScore = {
  studentName: string;
  ca: number | null;
  exam: number | null;
};

async function r2Get(key: string): Promise<Uint8Array> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  const response = await createR2Client(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  if (!response.Body) throw new Error(`Empty R2 object: ${key}`);
  return new Uint8Array(await response.Body.transformToByteArray());
}

async function r2Put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  await createR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

// Extracts CA/EXAM per student from the teacher's uploaded score records.
async function extractScores(
  attachments: Array<{ key: string; name: string; size?: number }>,
  subject: string,
  className: string,
): Promise<ExtractedScore[]> {
  if (attachments.length === 0) return [];

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string; filename?: string }
  > = [
    {
      type: "text",
      text: `Extract the CA and EXAM scores for every student from these score records for ${subject}, class ${className}. Reply with every student listed in the records.`,
    },
  ];

  for (const attachment of attachments) {
    const isSpreadsheet =
      attachment.name.endsWith(".xlsx") ||
      attachment.name.endsWith(".xls") ||
      attachment.name.endsWith(".csv");
    if (isSpreadsheet) {
      const bytes = await r2Get(attachment.key);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
      const lines: string[] = [];
      workbook.eachSheet((sheet) => {
        lines.push(`Sheet: ${sheet.name}`);
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const cells: string[] = [];
          row.eachCell({ includeEmpty: false }, (cell) => {
            const value = cell.value;
            if (value === null || value === undefined) return;
            if (typeof value === "object" && value !== null) {
              if ("text" in value && value.text !== null) cells.push(String(value.text));
              else if ("result" in value) cells.push(String(value.result));
              else if (value instanceof Date) cells.push(value.toISOString().slice(0, 10));
              return;
            }
            cells.push(String(value));
          });
          if (cells.length > 0) lines.push(cells.join(" | "));
        });
      });
      contentParts.push({ type: "text", text: `File: ${attachment.name}\n${lines.join("\n")}` });
      continue;
    }

    if (
      attachment.name.toLowerCase().endsWith(".pdf") ||
      /\.(png|jpe?g|webp|heic)$/i.test(attachment.name) ||
      attachment.name.toLowerCase().endsWith(".pdf")
    ) {
      const bytes = await r2Get(attachment.key);
      const mediaType = attachment.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg";
      contentParts.push({
        type: "file",
        data: bytes,
        mediaType,
        filename: attachment.name,
      });
      continue;
    }

    contentParts.push({
      type: "text",
      text: `[unreadable attachment: ${attachment.name}]`,
    });
  }

  const modelName = process.env.AI_MODEL;
  if (!modelName) {
    throw new Error("AI_MODEL is not set");
  }

  const { object } = await generateObject({
    model: openrouter.chat(modelName),
    schema: z.object({
      students: z.array(
        z.object({
          studentName: z.string(),
          ca: z.number().nullable(),
          exam: z.number().nullable(),
        }),
      ),
    }),
    messages: [
      {
        role: "user",
        content: contentParts,
      },
    ],
  });
  return object.students;
}

// Fuzzy-matches extracted names to the official roster names from the template.
function matchNames(
  extracted: ExtractedScore[],
  roster: string[],
): Array<{
  studentName: string;
  matchedName?: string;
  matchConfidence?: number;
  ca: number | null;
  exam: number | null;
  needsReview: boolean;
  source: "ai" | "manual" | "edited";
}> {
  const fuse = new Fuse(roster, { threshold: 0.4, ignoreLocation: true });
  return extracted.map((row) => {
    const hits = fuse.search(row.studentName);
    const best = hits[0];
    if (!best) {
      return {
        studentName: row.studentName,
        ca: row.ca,
        exam: row.exam,
        needsReview: true,
        source: "ai" as const,
      };
    }
    const confidence = 1 - (best.score ?? 1);
    return {
      studentName: row.studentName,
      matchedName: roster[best.refIndex],
      matchConfidence: Math.round(confidence * 100) / 100,
      ca: row.ca,
      exam: row.exam,
      needsReview: confidence < 0.75 || row.ca === null || row.exam === null,
      source: "ai" as const,
    };
  });
}

async function loadTemplate(bytes: Uint8Array): Promise<{
  workbook: ExcelJS.Workbook;
  grid: { rosterColumn: number; caColumn: number; examColumn: number; totalColumn: number | null; headerRow: number };
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Template has no worksheets");

  let headerRow = 0;
  let rosterColumn = 0;
  let caColumn = 0;
  let examColumn = 0;
  let totalColumn: number | null = null;

  for (let r = 1; r <= Math.min(sheet.rowCount, 10); r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= row.cellCount; c++) {
      const value = row.getCell(c).value;
      const text = typeof value === "string" ? value : "";
      const normalized = text.trim().toLowerCase();
      if (!rosterColumn && (normalized === "name" || normalized.includes("student"))) {
        rosterColumn = c;
      }
      if (!caColumn && (normalized === "ca" || normalized.includes("continuous"))) {
        caColumn = c;
      }
      if (!examColumn && (normalized === "exam" || normalized.includes("examination"))) {
        examColumn = c;
      }
      if (normalized === "total" || normalized.includes("total")) {
        totalColumn = c;
      }
    }
    if (rosterColumn && caColumn && examColumn) {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) {
    throw new Error(
      "Could not find NAME/CA/EXAM header row in the template (Phase 0 will pin the exact layout)",
    );
  }
  return {
    workbook,
    grid: { rosterColumn, caColumn, examColumn, totalColumn, headerRow },
  };
}

// Writes matched scores into the template, preserving everything else.
function fillTemplate(
  workbook: ExcelJS.Workbook,
  grid: { rosterColumn: number; caColumn: number; examColumn: number; totalColumn: number | null; headerRow: number },
  mappings: Array<{
    studentName: string;
    matchedName?: string;
    ca: number | null;
    exam: number | null;
  }>,
): { roster: string[] } {
  const sheet = workbook.worksheets[0];
  const roster: string[] = [];
  const byRosterName = new Map<string, (typeof mappings)[number]>();
  for (const mapping of mappings) {
    const key = (mapping.matchedName ?? mapping.studentName).trim().toLowerCase();
    byRosterName.set(key, mapping);
  }

  for (let r = grid.headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rosterCell = row.getCell(grid.rosterColumn);
    const rosterName = typeof rosterCell.value === "string" ? rosterCell.value.trim() : "";
    if (!rosterName) continue;
    roster.push(rosterName);

    const mapping = byRosterName.get(rosterName.toLowerCase());
    if (!mapping) continue;

    if (mapping.ca !== null) row.getCell(grid.caColumn).value = mapping.ca;
    if (mapping.exam !== null) row.getCell(grid.examColumn).value = mapping.exam;
    // Total is computed at fill time, never stored in the DB.
    if (grid.totalColumn && mapping.ca !== null && mapping.exam !== null) {
      row.getCell(grid.totalColumn).value = mapping.ca + mapping.exam;
    }
    row.commit();
  }
  return { roster };
}

// Completeness audit per subject sheet: every roster row scored, ranges valid.
function checkCompleteness(
  roster: string[],
  mappings: Array<{ studentName: string; matchedName?: string; ca: number | null; exam: number | null; needsReview: boolean }>,
  range: { ca: [number, number]; exam: [number, number] },
): { complete: boolean; issues: string[] } {
  const issues: string[] = [];
  const matched = new Set(
    mappings
      .filter((m) => m.matchedName)
      .map((m) => (m.matchedName as string).trim().toLowerCase()),
  );
  for (const name of roster) {
    if (!matched.has(name.trim().toLowerCase())) {
      issues.push(`No score mapped for roster student: ${name}`);
    }
  }
  for (const mapping of mappings) {
    const label = mapping.matchedName ?? mapping.studentName;
    if (mapping.ca !== null && (mapping.ca < range.ca[0] || mapping.ca > range.ca[1])) {
      issues.push(`CA out of range (${mapping.ca}) for ${label}`);
    }
    if (mapping.exam !== null && (mapping.exam < range.exam[0] || mapping.exam > range.exam[1])) {
      issues.push(`EXAM out of range (${mapping.exam}) for ${label}`);
    }
  }
  return { complete: issues.length === 0, issues };
}

// Child task: download the template (or reuse), extract + match scores, fill
// the sheet, run the completeness audit, then pause for teacher review.
export const prepareTermSheet = task({
  id: "prepare-term-sheet",
  machine: { preset: "micro" },
  maxDuration: 900,
  retry: { maxAttempts: 2 },
  run: async (payload: Payload) => {
    const adapter = getAdapter(payload.portalKey);
    const state = await getSubmissionState(payload.submissionId);

    let templateBytes: Uint8Array;
    let templateName: string;

    if (payload.reuseTemplate && state.files.template) {
      logger.info("reusing stored template", { key: state.files.template.key });
      templateBytes = await r2Get(state.files.template.key);
      templateName = state.files.template.originalName;
    } else {
      logger.info("downloading template from portal");
      const session: PortalSession = { cookies: payload.cookies };
      const downloaded = await withLightpanda(async (browser: Browser) => {
        const page: Page = await browser.newPage();
        return await adapter.downloadTemplate(page, session, {
          className: payload.className,
          subject: payload.subject,
          term: payload.term,
          academicYear: payload.academicYear,
        });
      });
      templateBytes = downloaded.bytes;
      templateName = downloaded.filename;

      await r2Put(
        `submissions/${payload.submissionId}/template/${templateName}`,
        templateBytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    }

  const { workbook, grid } = await loadTemplate(templateBytes);
  const rosterSheet = workbook.worksheets[0];
  const roster: string[] = [];
  for (let r = grid.headerRow + 1; r <= rosterSheet.rowCount; r++) {
    const value = rosterSheet.getRow(r).getCell(grid.rosterColumn).value;
    if (typeof value === "string" && value.trim()) roster.push(value.trim());
  }

  // Extract scores from uploads (skipped when mappings already exist).
  let mappings =
    state.mappings.length > 0
      ? state.mappings.map((m) => ({
          studentName: m.studentName,
          matchedName: m.matchedName ?? undefined,
          ca: m.ca ?? null,
          exam: m.exam ?? null,
          needsReview: m.needsReview,
          source: m.source as "ai" | "manual" | "edited",
        }))
      : await extractScores(state.files.uploads, payload.subject, payload.className);

  const matched = matchNames(mappings, roster);
  mappings = matched;

  const filled = fillTemplate(workbook, grid, matched);
  const completeness = checkCompleteness(filled.roster, matched, adapter.scoreRange);

  const filledBuffer = await workbook.xlsx.writeBuffer();
  const filledKey = `submissions/${payload.submissionId}/filled/${templateName}`;
  await r2Put(
    filledKey,
    new Uint8Array(filledBuffer),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  await updateSubmission({
    submissionId: payload.submissionId,
    expectStatus: "preparing",
    status: "awaiting_review",
    templateKey: `submissions/${payload.submissionId}/template/${templateName}`,
    templateName,
    filledKey,
    filledName: templateName,
    mappings: matched.map((m) => ({
      studentName: m.studentName,
      matchedName: m.matchedName,
      matchConfidence: m.matchConfidence,
      ca: m.ca ?? undefined,
      exam: m.exam ?? undefined,
      needsReview: m.needsReview,
      source: m.source,
    })),
    auditEvent: "awaiting_review",
    auditDetail: {
      templateName,
      completeness,
      rosterSize: filled.roster.length,
    },
  });

  logger.info("prepared for review", { completeness });
  return { status: "awaiting_review" as const, completeness };
  },
});

