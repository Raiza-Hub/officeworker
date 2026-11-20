"use node";

import Fuse from "fuse.js";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import type { FileOwner } from "./agentFilesDb";
import { createR2Client, getR2Config } from "./r2";
import { spreadsheetToText } from "./chatActions";

const MAX_READ_CHARS = 100_000;

async function r2Get(key: string): Promise<Uint8Array> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  const response = await createR2Client(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  const body = response.Body;
  if (!body) throw new Error(`Empty R2 object: ${key}`);
  return new Uint8Array(await body.transformToByteArray());
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

function baseName(key: string, name?: string): string {
  if (name && name.trim()) return name.trim();
  return key.split("/").pop() ?? key;
}

function truncate(text: string, label: string): string {
  if (text.length <= MAX_READ_CHARS) return text;
  return (
    text.slice(0, MAX_READ_CHARS) +
    `\n\n[Truncated: showing the first ${MAX_READ_CHARS} characters of ${text.length.toLocaleString()} in ${label}. Ask about specific rows, columns, or sections instead of the whole file.]`
  );
}

// Detects the NAME/CA/EXAM header grid (same heuristics as the trigger-side
// template loader) and returns the roster plus per-row cell values.
async function detectGrid(bytes: Uint8Array): Promise<{
  headerRow: number;
  rosterColumn: number;
  caColumn: number;
  examColumn: number;
  totalColumn: number | null;
  roster: string[];
  rowValues: Array<{ name: string; ca: string | null; exam: string | null }>;
} | null> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const sheet = workbook.worksheets[0];
  if (!sheet) return null;

  let headerRow = 0;
  let rosterColumn = 0;
  let caColumn = 0;
  let examColumn = 0;
  let totalColumn: number | null = null;

  for (let r = 1; r <= Math.min(sheet.rowCount, 10); r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= row.cellCount; c++) {
      const value = row.getCell(c).value;
      const text = typeof value === "string" ? value.trim().toLowerCase() : "";
      if (!rosterColumn && (text === "name" || text.includes("student"))) rosterColumn = c;
      if (!caColumn && (text === "ca" || text.includes("continuous"))) caColumn = c;
      if (!examColumn && (text === "exam" || text.includes("examination"))) examColumn = c;
      if (text === "total" || text.includes("total")) totalColumn = c;
    }
    if (rosterColumn && caColumn && examColumn) {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) return null;

  const roster: string[] = [];
  const rowValues: Array<{ name: string; ca: string | null; exam: string | null }> = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rosterCell = row.getCell(rosterColumn).value;
    const name = typeof rosterCell === "string" ? rosterCell.trim() : "";
    if (!name) continue;
    roster.push(name);
    const cellText = (column: number): string | null => {
      if (!column) return null;
      const value = row.getCell(column).value;
      if (value === null || value === undefined || value === "") return null;
      if (typeof value === "object" && "result" in value) {
        return value.result === null || value.result === undefined
          ? null
          : String(value.result);
      }
      return String(value);
    };
    rowValues.push({ name, ca: cellText(caColumn), exam: cellText(examColumn) });
  }
  return { headerRow, rosterColumn, caColumn, examColumn, totalColumn, roster, rowValues };
}

function readErrorMessage(name: string): string {
  if (/\.pdf$/i.test(name)) {
    return `${name} is a PDF — this tool can only return text. Ask the teacher to attach it to a chat message so it can be viewed directly.`;
  }
  if (/\.(png|jpe?g|webp|heic|gif)$/i.test(name)) {
    return `${name} is an image — this tool can only return text. Ask the teacher to attach it to a chat message so it can be viewed directly.`;
  }
  if (/\.(docx?|pptx?|odt|rtf)$/i.test(name)) {
    return `${name} is a document format that cannot be read as text yet. Ask the teacher to attach it to a chat message, or export it to CSV/XLSX first.`;
  }
  return `${name} is not a readable text, spreadsheet, or CSV file.`;
}

// read_file: any workspace spreadsheet/CSV/text file → generic text. No
// schema: the agent reasons over the raw content per the user's prompt.
export const readFileAction = internalAction({
  args: { key: v.string(), name: v.optional(v.string()), userId: v.id("users") },
  handler: async (ctx, args): Promise<string> => {
    const owner = (await ctx.runQuery(internal.agentFilesDb.resolveFileOwnership, {
      key: args.key,
      userId: args.userId,
    })) as FileOwner;
    if (owner === null) {
      return "Access denied: that file is not in your workspace.";
    }

    const name = baseName(args.key, args.name);
    if (/\.(xlsx|xls|csv|tsv)$/i.test(name)) {
      const bytes = await r2Get(args.key);
      const text = await spreadsheetToText(Buffer.from(bytes), name);
      return truncate(text, name);
    }
    if (/\.(txt|md|json|log)$/i.test(name)) {
      const bytes = await r2Get(args.key);
      return truncate(Buffer.from(bytes).toString("utf8"), name);
    }
    return readErrorMessage(name);
  },
});

// edit_file: generic A1-notation cell edits on xlsx/csv. With a submissionId
// the result becomes the submission's filled sheet — needsReview is forced
// true and the status moves to awaiting_review; nothing uploads to the
// portal until the teacher approves. Without one, a versioned copy is
// written next to the original.
export const editFileAction = internalAction({
  args: {
    key: v.string(),
    edits: v.array(
      v.object({
        cell: v.string(),
        value: v.union(v.string(), v.number(), v.null()),
      }),
    ),
    name: v.optional(v.string()),
    userId: v.id("users"),
    submissionId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (args.edits.length === 0) return "No edits provided.";
    const cellPattern = /^[A-Za-z]{1,3}[1-9][0-9]{0,6}$/;
    for (const edit of args.edits) {
      if (!cellPattern.test(edit.cell)) {
        return `Invalid cell reference "${edit.cell}" — use A1 notation like C7.`;
      }
    }

    const owner = (await ctx.runQuery(internal.agentFilesDb.resolveFileOwnership, {
      key: args.key,
      userId: args.userId,
    })) as FileOwner;
    if (owner === null) {
      return "Access denied: that file is not in your workspace.";
    }
    if (args.submissionId !== undefined) {
      if (owner.kind !== "submission" || owner.submissionId !== args.submissionId) {
        return "That file does not belong to the given submission.";
      }
    }

    const name = baseName(args.key, args.name);
    const isCsv = /\.(csv|tsv)$/i.test(name);
    const isXlsx = /\.(xlsx|xls)$/i.test(name);
    if (!isCsv && !isXlsx) {
      return `Only .xlsx, .xls and .csv files can be edited — ${name} is not editable.`;
    }

    const bytes = await r2Get(args.key);
    const submissionEdit =
      args.submissionId !== undefined || owner.kind === "submission";

    if (isXlsx) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
      const sheet = workbook.worksheets[0];
      if (!sheet) return `${name} has no worksheets.`;
      for (const edit of args.edits) {
        const letters = edit.cell.replace(/[0-9]/g, "").toUpperCase();
        const rowNumber = Number(edit.cell.replace(/[^0-9]/g, ""));
        let column = 0;
        for (const char of letters) column = column * 26 + (char.charCodeAt(0) - 64);
        sheet.getRow(rowNumber).getCell(column).value = edit.value;
        sheet.getRow(rowNumber).commit();
      }
      const written = new Uint8Array(await workbook.xlsx.writeBuffer());

      if (submissionEdit) {
        const submissionId =
          args.submissionId ?? (owner.kind === "submission" ? owner.submissionId : "");
        const filledKey = `submissions/${submissionId}/filled/${name}`;
        await r2Put(filledKey, written, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId: submissionId as Id<"submissions">,
          status: "awaiting_review",
          needsReview: true,
          edits: args.edits,
          filledKey,
          filledName: name,
          auditEvent: "sheet_edited",
          auditDetail: { edits: args.edits },
        });
        return `Applied ${args.edits.length} cell edit(s) to ${name} and saved the filled sheet. The submission is now awaiting the teacher's review — do not upload until they explicitly approve.`;
      }

      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      const editedName = `${stem}-edited-${Date.now()}${ext}`;
      const newKey = `${args.key.split("/").slice(0, -1).join("/")}/${editedName}`.replace(/^\/+/, "");
      await r2Put(
        newKey,
        written,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      if (owner.kind === "document") {
        await ctx.runMutation(internal.agentFilesDb.registerEditedDocument, {
          userId: args.userId,
          storageKey: newKey,
          originalKey: args.key,
          name: editedName,
          size: written.length,
        });
      }
      return `Applied ${args.edits.length} cell edit(s). Saved as a new copy: ${editedName} (key: ${newKey}). The original file is unchanged.`;
    }

    // CSV path: parse → apply → stringify.
    const parsed = Papa.parse<string[]>(Buffer.from(bytes).toString("utf8"), {
      skipEmptyLines: false,
    });
    const rows = parsed.data.map((row) => (row ?? []).map((cell) => String(cell ?? "")));
    for (const edit of args.edits) {
      const letters = edit.cell.replace(/[0-9]/g, "").toUpperCase();
      const rowNumber = Number(edit.cell.replace(/[^0-9]/g, ""));
      let column = 0;
      for (const char of letters) column = column * 26 + (char.charCodeAt(0) - 64);
      const rowIndex = rowNumber - 1;
      const colIndex = column - 1;
      while (rows.length <= rowIndex) rows.push([]);
      const row = rows[rowIndex];
      while (row.length <= colIndex) row.push("");
      row[colIndex] = edit.value === null ? "" : String(edit.value);
    }
    const csvText = Papa.unparse(rows);
    const written = new TextEncoder().encode(csvText);

    if (submissionEdit) {
      return "Submission sheets must be .xlsx files — this CSV cannot be used as a filled term sheet.";
    }
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    const editedName = `${stem}-edited-${Date.now()}${ext}`;
    const newKey = `${args.key.split("/").slice(0, -1).join("/")}/${editedName}`.replace(/^\/+/, "");
    await r2Put(newKey, written, "text/csv");
    if (owner.kind === "document") {
      await ctx.runMutation(internal.agentFilesDb.registerEditedDocument, {
        userId: args.userId,
        storageKey: newKey,
        originalKey: args.key,
        name: editedName,
        size: written.length,
      });
    }
    return `Applied ${args.edits.length} cell edit(s). Saved as a new copy: ${editedName} (key: ${newKey}). The original file is unchanged.`;
  },
});

// match_names: fuzzy name matching backed by Fuse.js. The agent constructs
// the Fuse configuration itself (options below are the JSON-safe subset) and
// re-adjusts based on the returned scores. Always returns scores.
export const matchNamesAction = internalAction({
  args: {
    queries: v.array(v.string()),
    roster: v.optional(v.array(v.string())),
    submissionId: v.optional(v.string()),
    userId: v.id("users"),
    options: v.optional(
      v.object({
        threshold: v.optional(v.number()),
        ignoreLocation: v.optional(v.boolean()),
        distance: v.optional(v.number()),
        isCaseSensitive: v.optional(v.boolean()),
        ignoreDiacritics: v.optional(v.boolean()),
        minMatchCharLength: v.optional(v.number()),
        findAllMatches: v.optional(v.boolean()),
        includeMatches: v.optional(v.boolean()),
        shouldSort: v.optional(v.boolean()),
        useExtendedSearch: v.optional(v.boolean()),
        useTokenSearch: v.optional(v.boolean()),
        tokenMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
        ignoreFieldNorm: v.optional(v.boolean()),
        fieldNormWeight: v.optional(v.number()),
        location: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    let roster = args.roster;
    if ((roster === undefined || roster.length === 0) && args.submissionId !== undefined) {
      const templateKey = await ctx.runQuery(internal.agentFilesDb.getSubmissionTemplateKey, {
        submissionId: args.submissionId,
        userId: args.userId,
      });
      if (templateKey === null) {
        return "No template on this submission yet — the roster is not available. Use create_submission first, or pass the roster explicitly.";
      }
      const bytes = await r2Get(templateKey);
      const grid = await detectGrid(bytes);
      roster = grid?.roster ?? [];
    }
    if (roster === undefined || roster.length === 0) {
      return "No roster to match against — pass `roster` explicitly or use a submission that has a template.";
    }

    const fuse = new Fuse(roster, {
      ...args.options,
      includeScore: true,
      shouldSort: args.options?.shouldSort ?? true,
    });
    const results = args.queries.map((query) => ({
      query,
      matches: fuse.search(query)
        .slice(0, 5)
        .map((hit) => ({
          name: hit.item,
          score: hit.score ?? 1,
          confidence: Math.round((1 - (hit.score ?? 1)) * 100) / 100,
        })),
    }));
    return JSON.stringify({ results });
  },
});
