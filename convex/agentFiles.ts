"use node";

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

function readErrorMessage(name: string): string {
  if (/\.pdf$/i.test(name)) {
    return `${name} is a PDF — PDFs/images attached in chat are understood directly by the assistant. If this file is not in the chat, ask the teacher to attach it or export a readable form.`;
  }
  if (/\.(png|jpe?g|webp|heic|gif)$/i.test(name)) {
    return `${name} is an image — images attached in chat are understood directly by the assistant. If this file is not in the chat, ask the teacher to attach it or export a readable form.`;
  }
  if (/\.(docx?|pptx?|odt|rtf)$/i.test(name)) {
    return `${name} is a document format that cannot be parsed as text here. Ask the teacher to attach it to chat if viewable, or export it to a readable form (CSV/XLSX/TXT).`;
  }
  return `${name} is not a parseable/readable text or spreadsheet file. Ask the teacher to provide a readable export if needed; do not guess.`;
}

// read_file: parseable workspace files → text for the agent to understand/act on.
// PDFs/images should be attached in chat for direct multimodal understanding.
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

// edit_file: generic A1-notation cell edits on xlsx/csv.
// With a submissionId the result becomes the submission's upload candidate and
// the submission moves to awaiting_review — nothing uploads to the portal until
// the teacher explicitly approves. Without one, a versioned copy is written.
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
    const submissionEdit = args.submissionId !== undefined;

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
        const submissionId = args.submissionId as Id<"submissions">;
        const candidateKey = `submissions/${submissionId}/candidates/${Date.now()}-${name}`;
        await r2Put(
          candidateKey,
          written,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        await ctx.runMutation(internal.submissions.updateSubmission, {
          submissionId,
          status: "awaiting_review",
          edits: args.edits,
          uploadCandidate: { key: candidateKey, name, size: written.length },
          auditEvent: "upload_candidate_prepared",
          auditDetail: { edits: args.edits, key: candidateKey, name },
        });
        return `Applied ${args.edits.length} cell edit(s) to ${name} and saved it as the upload candidate. The submission is awaiting explicit teacher approval — do not upload until they approve.`;
      }

      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      const editedName = `${stem}-edited-${Date.now()}${ext}`;
      const baseDir = args.key.split("/").slice(0, -1).join("/");
      const newKey = `${baseDir}/${editedName}`.replace(/^\/+/, "");
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

    // CSV/TSV path: parse → apply → stringify.
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
      const submissionId = args.submissionId as Id<"submissions">;
      const candidateKey = `submissions/${submissionId}/candidates/${Date.now()}-${name}`;
      await r2Put(candidateKey, written, "text/csv");
      await ctx.runMutation(internal.submissions.updateSubmission, {
        submissionId,
        status: "awaiting_review",
        edits: args.edits,
        uploadCandidate: { key: candidateKey, name, size: written.length },
        auditEvent: "upload_candidate_prepared",
        auditDetail: { edits: args.edits, key: candidateKey, name },
      });
      return `Applied ${args.edits.length} cell edit(s) to ${name} and saved it as the upload candidate. The submission is awaiting explicit teacher approval — do not upload until they approve.`;
    }

    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    const editedName = `${stem}-edited-${Date.now()}${ext}`;
    const baseDir = args.key.split("/").slice(0, -1).join("/");
    const newKey = `${baseDir}/${editedName}`.replace(/^\/+/, "");
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

export const setUploadCandidateAction = internalAction({
  args: {
    submissionId: v.string(),
    key: v.string(),
    userId: v.id("users"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const state = await ctx.runQuery(internal.agentFilesDb.getSubmissionState, {
      submissionId: args.submissionId,
      userId: args.userId,
    });
    if (!state) return "Submission not found in your workspace.";
    const owner = (await ctx.runQuery(internal.agentFilesDb.resolveFileOwnership, {
      key: args.key,
      userId: args.userId,
    })) as FileOwner;
    if (owner === null) {
      return "Access denied: that file is not in your workspace.";
    }
    if (owner.kind === "submission" && owner.submissionId !== args.submissionId) {
      return "That file belongs to a different submission. Choose a file from this submission or your workspace documents.";
    }
    const name = baseName(args.key, args.name);
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId as Id<"submissions">,
      status: "awaiting_review",
      uploadCandidate: { key: args.key, name },
      auditEvent: "upload_candidate_set",
      auditDetail: { key: args.key, name },
    });
    return `Upload candidate set to ${name} (${args.key}). The submission is awaiting explicit teacher approval — do not upload until they approve.`;
  },
});
