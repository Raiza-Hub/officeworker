"use node";

import { generateText, type ModelMessage } from "ai";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";
import ExcelJS from "exceljs";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  abortStream,
  getThreadMetadata,
  updateThreadMetadata,
  saveMessage,
} from "@convex-dev/agent";
import { agent, TITLE_INSTRUCTIONS, cleanTitle } from "./agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createR2Client, getR2Config } from "./r2";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

type Attachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

async function fetchObjectBytes(key: string): Promise<Uint8Array> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  const response = await createR2Client(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  const body = response.Body;
  if (!body) throw new Error(`Empty object for ${key}`);
  return new Uint8Array(await body.transformToByteArray());
}

async function spreadsheetToText(buffer: Buffer, name: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const lines: string[] = [`# File: ${name}`];
  workbook.eachSheet((sheet) => {
    lines.push(`\n## Sheet: ${sheet.name}`);
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const value = cell.value;
        if (value === null || value === undefined) return;
        if (typeof value === "object" && value !== null) {
          if ("text" in value && value.text !== null) {
            cells.push(String(value.text));
          } else if ("richText" in value && Array.isArray(value.richText)) {
            cells.push(
              value.richText
                .map((part) => String(part.text ?? ""))
                .join(""),
            );
          } else if ("result" in value) {
            cells.push(String(value.result));
          } else if (value instanceof Date) {
            cells.push(value.toISOString().slice(0, 10));
          } else if ("hyperlink" in value && "text" in value) {
            cells.push(String(value.text));
          }
          return;
        }
        cells.push(String(value));
      });
      if (cells.length > 0) lines.push(cells.join(" | "));
    });
  });
  return lines.join("\n");
}

// Renders attachments into model-message parts: images/PDFs inline for
// multimodal models, spreadsheets parsed to text.
async function buildAttachmentMessages(
  attachments: Attachment[],
): Promise<ModelMessage[]> {
  const fileParts: Extract<ModelMessage, { role: "user" }>["content"] = [];
  const textChunks: string[] = [];

  const results = await Promise.all(
    attachments.map(async (attachment) => {
      const isSpreadsheet =
        attachment.mediaType.includes("sheet") ||
        attachment.mediaType.includes("csv") ||
        /\.(xlsx|xls|csv)$/i.test(attachment.name);

      if (isSpreadsheet) {
        const bytes = await fetchObjectBytes(attachment.key);
        const text = await spreadsheetToText(Buffer.from(bytes), attachment.name);
        return { kind: "text" as const, text };
      }

      const inline =
        attachment.mediaType.startsWith("image/") ||
        attachment.mediaType === "application/pdf";

      if (inline && attachment.size <= 10 * 1024 * 1024) {
        const bytes = await fetchObjectBytes(attachment.key);
        return {
          kind: "file" as const,
          part: {
            type: "file" as const,
            data: new Uint8Array(bytes),
            mediaType: attachment.mediaType,
            filename: attachment.name,
          },
        };
      }

      return {
        kind: "note" as const,
        note: `[Attached file: ${attachment.name} (${attachment.mediaType}, ${attachment.size} bytes) - not readable inline]`,
      };
    }),
  );
  for (const result of results) {
    if (result.kind === "text") {
      textChunks.push(result.text);
    } else if (result.kind === "file") {
      fileParts.push(result.part);
    } else {
      textChunks.push(result.note);
    }
  }

  const messages: ModelMessage[] = [];
  if (fileParts.length > 0) {
    messages.push({ role: "user", content: fileParts });
  }
  if (textChunks.length > 0) {
    messages.push({
      role: "user",
      content: `Contents of the attached spreadsheets:\n\n${textChunks.join("\n\n")}`,
    });
  }
  return messages;
}

export const generateReply = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    attachments: v.array(
      v.object({
        key: v.string(),
        name: v.string(),
        mediaType: v.string(),
        size: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let turnStatus: "completed" | "failed" | "cancelled" = "completed";
    let startedAt: number | null = null;
    const streamState = { finalizedByAgent: false };
    try {
      if (
        await ctx.runQuery(internal.chat.isTurnCancelled, {
          promptMessageId: args.promptMessageId,
        })
      ) {
        turnStatus = "cancelled";
        return;
      }
      const attachmentMessages =
        args.attachments.length > 0
          ? await buildAttachmentMessages(args.attachments)
          : [];

      startedAt = await ctx.runMutation(internal.chat.recordTurnStarted, {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
      });

      // Stream-phase errors are handled by the Agent itself: its internal
      // onError finalizes the pending assistant message as "failed" (or
      // materializes partial output) and marks the stream "aborted". Our
      // onError callback runs after that cleanup, so it tells us whether
      // the failure belongs to the stream phase.
      const result = await agent.streamText(
        ctx,
        { threadId: args.threadId },
        {
          promptMessageId: args.promptMessageId,
          messages: attachmentMessages,
          onError: () => {
            streamState.finalizedByAgent = true;
          },
        },
        { saveStreamDeltas: true },
      );
      if (
        await ctx.runQuery(internal.chat.isTurnCancelled, {
          promptMessageId: args.promptMessageId,
        })
      ) {
        if (result.order !== undefined) {
          await abortStream(ctx, components.agent, {
            threadId: args.threadId,
            order: result.order,
            reason: "User cancelled",
          });
        }
        turnStatus = "cancelled";
      } else {
        await result.consumeStream();
      }
    } catch (error) {
      const wasCancelled = await ctx.runQuery(
        internal.chat.isTurnCancelled,
        { promptMessageId: args.promptMessageId },
      );
      if (wasCancelled) {
        turnStatus = "cancelled";
      } else {
        turnStatus = "failed";
        const reason =
          error instanceof Error ? error.message : "Unknown error";
        console.error("generateReply failed", {
          threadId: args.threadId,
          error,
        });
        // Failures the Agent has already finalized need nothing more done.
        // Only pre-stream failures (attachment prep, generation setup) leave
        // the thread without any assistant message — surface those ourselves.
        if (!streamState.finalizedByAgent) {
          try {
            await saveMessage(ctx, components.agent, {
              threadId: args.threadId,
              agentName: "Officeworker Assistant",
              message: {
                role: "assistant",
                content:
                  `Something went wrong while preparing your message ` +
                  `(${reason}). Your message is saved exactly as you sent it — ` +
                  "just resend it to try again.",
              },
            });
          } catch (saveError) {
            console.error("failed to save error message", saveError);
          }
        }
      }
    } finally {
      if (startedAt !== null) {
        await ctx.runMutation(internal.chat.recordTurnFinished, {
          promptMessageId: args.promptMessageId,
          finishedAt: Date.now(),
          status: turnStatus,
        });
      }
    }
  },
});

export const generateThreadTitle = internalAction({
  args: {
    threadId: v.string(),
    promptText: v.string(),
  },
  handler: async (ctx, args) => {
    await maybeGenerateTitle(ctx, args.threadId, args.promptText);
  },
});

const GREETING_ONLY =
  /^(hi|hello|hey|hey there|hi there|good morning|good afternoon|good evening|yo|hola|thanks|thank you|ok|okay|yes|hmm|dear sir|dear ma|how far)[!.]*$/i;

async function maybeGenerateTitle(
  ctx: ActionCtx,
  threadId: string,
  promptText: string,
): Promise<void> {
  try {
    const metadata = await getThreadMetadata(ctx, components.agent, {
      threadId,
    });
    if (metadata.title) return;

    const fallback = promptText.slice(0, 50).trim() || "New chat";

    // Skip the LLM call on trivial inputs (greeting / <3 words) — the
    // truncation fallback is a perfectly good title here.
    const wordCount = promptText.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 3 || GREETING_ONLY.test(promptText.trim())) {
      await applyTitle(ctx, threadId, fallback);
      return;
    }

    const contextText = `User: ${promptText.slice(0, 1000)}`;

    let title = fallback;
    try {
      title = cleanTitle(await generateTitleText(contextText), fallback);
    } catch {
      // Keep the fallback title if both attempts fail.
    }

    await applyTitle(ctx, threadId, title);
  } catch (error) {
    console.error("title generation failed", error);
  }
}

async function generateTitleText(contextText: string): Promise<string> {
  const modelName = process.env.AI_MODEL;
  if (!modelName) {
    throw new Error("AI_MODEL is not set");
  }
  const model = openrouter.chat(modelName);
  try {
    const { text } = await generateText({
      model,
      instructions: TITLE_INSTRUCTIONS,
      prompt: contextText.slice(0, 2000),
      temperature: 0.2,
      providerOptions: {
        openrouter: { reasoning: { maxTokens: 0 } },
      },
    });
    if (text) return text;
    throw new Error("empty title output");
  } catch {
    // Some providers reject the reasoning override — retry without it.
    const { text } = await generateText({
      model,
      instructions: TITLE_INSTRUCTIONS,
      prompt: contextText.slice(0, 2000),
      temperature: 0.2,
    });
    return text;
  }
}

// Non-destructive write: re-check the title right before applying so a
// concurrently generated/manual title always wins (industry setTitleIfNull).
async function applyTitle(
  ctx: ActionCtx,
  threadId: string,
  title: string,
): Promise<void> {
  const metadata = await getThreadMetadata(ctx, components.agent, {
    threadId,
  });
  if (metadata.title) return;
  await updateThreadMetadata(ctx, components.agent, {
    threadId,
    patch: { title },
  });
  await ctx.runMutation(internal.chat.setThreadTitle, { threadId, title });
}
