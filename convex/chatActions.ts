"use node";

import { generateText, type ModelMessage } from "ai";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { abortStream, getThreadMetadata, saveMessage } from "@convex-dev/agent";
import { createBillingAgent, TITLE_INSTRUCTIONS, cleanTitle } from "./agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createR2Client, getR2Config } from "./r2";
import { isSpreadsheetAttachment } from "../lib/attachments";
import {
  estimateOpenRouterCostUsd,
  openRouterCostUsd,
} from "../lib/billing";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

type Attachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

const INLINE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MODEL_FILE_URL_TTL_SECONDS = 15 * 60;

function isPdfAttachment(attachment: Attachment): boolean {
  return (
    attachment.mediaType === "application/pdf" || /\.pdf$/i.test(attachment.name)
  );
}

function openRouterChargeUsd(usage: unknown, providerMetadata: unknown): number {
  if ((process.env.AI_MODEL ?? "").toLowerCase() === "openrouter/free") {
    return 0;
  }
  return (
    openRouterCostUsd(usage, providerMetadata) ??
    estimateOpenRouterCostUsd(usage)
  );
}

async function signObjectReadUrl(attachment: Attachment): Promise<string> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  const filename = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  return getSignedUrl(
    createR2Client(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: attachment.key,
      ResponseContentDisposition: `inline; filename="${filename}"`,
    }),
    { expiresIn: MODEL_FILE_URL_TTL_SECONDS },
  );
}

export async function fetchObjectBytes(key: string): Promise<Uint8Array> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  const response = await createR2Client(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  const body = response.Body;
  if (!body) throw new Error(`Empty object for ${key}`);
  return new Uint8Array(await body.transformToByteArray());
}

export async function spreadsheetToText(
  buffer: Buffer,
  name: string,
): Promise<string> {
  if (/\.(csv|tsv)$/i.test(name)) {
    const lines: string[] = [`# File: ${name}`];
    const parsed = Papa.parse<string[]>(buffer.toString("utf8"), {
      skipEmptyLines: "greedy",
    });
    for (const row of parsed.data) {
      const cells = (row ?? []).map((cell) => String(cell ?? ""));
      if (cells.length > 0) lines.push(cells.join(" | "));
    }
    return lines.join("\n");
  }
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
      if (isSpreadsheetAttachment(attachment)) {
        const bytes = await fetchObjectBytes(attachment.key);
        const text = await spreadsheetToText(Buffer.from(bytes), attachment.name);
        return { kind: "text" as const, text };
      }

      const inline =
        attachment.mediaType.startsWith("image/") ||
        isPdfAttachment(attachment);

      if (inline && attachment.size <= INLINE_ATTACHMENT_BYTES) {
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

      if (inline) {
        try {
          const url = await signObjectReadUrl(attachment);
          return {
            kind: "file" as const,
            part: {
              type: "file" as const,
              data: { type: "url" as const, url: new URL(url) },
              mediaType: attachment.mediaType,
              filename: attachment.name,
            },
          };
        } catch (error) {
          console.error("attachment url signing failed", {
            key: attachment.key,
            error,
          });
        }
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
    userId: v.id("users"),
    reservationId: v.id("usageReservations"),
    reservationKey: v.string(),
    holdKobo: v.number(),
    customToolHolds: v.optional(
      v.array(
        v.object({
          reservationId: v.id("usageReservations"),
          attachmentKey: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let turnStatus: "completed" | "failed" | "cancelled" = "completed";
    let startedAt: number | null = null;
    const streamState = { finalizedByAgent: false };
    let providerCostUsd = 0;
    const customToolHolds = args.customToolHolds ?? [];
    const releaseCustomToolHolds = async (reason: string) => {
      if (customToolHolds.length === 0) return;
      await ctx.runMutation(internal.credits.releaseReservations, {
        reservationIds: customToolHolds.map((hold) => hold.reservationId),
        reason,
      });
    };
    const settleCustomToolHolds = async () => {
      if (customToolHolds.length === 0) return;
      await ctx.runMutation(internal.credits.settleCustomToolHolds, {
        holds: customToolHolds.map((hold) => ({
          reservationId: hold.reservationId,
          providerRef: args.promptMessageId,
          usage: {
            promptMessageId: args.promptMessageId,
            toolName: "spreadsheet_parse",
            attachmentKey: hold.attachmentKey,
          },
          idempotencyKey: `custom_tool:${hold.reservationId}`,
        })),
      });
    };
    try {
      if (
        await ctx.runQuery(internal.chat.isTurnCancelled, {
          promptMessageId: args.promptMessageId,
        })
      ) {
        turnStatus = "cancelled";
        await ctx.runMutation(internal.credits.releaseReservation, {
          reservationId: args.reservationId,
          reason: "cancelled_before_start",
        });
        await releaseCustomToolHolds("cancelled_before_start");
        return;
      }
      const attachmentMessages =
        args.attachments.length > 0
          ? await buildAttachmentMessages(args.attachments)
          : [];
      await settleCustomToolHolds();
      const fileParserModel =
        args.attachments.some(isPdfAttachment) && process.env.AI_MODEL
          ? openrouter.chat(process.env.AI_MODEL, {
              plugins: [
                {
                  id: "file-parser",
                  pdf: { engine: "cloudflare-ai" },
                },
              ],
            })
          : undefined;

      startedAt = await ctx.runMutation(internal.chat.recordTurnStarted, {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
      });

      const billingAgent = createBillingAgent(
        async (_ctx, { usage, providerMetadata }) => {
          const stepCost = openRouterChargeUsd(usage, providerMetadata);
          providerCostUsd += stepCost;
          await ctx.runMutation(internal.credits.enqueueSettlement, {
            reservationId: args.reservationId,
            userId: args.userId,
            providerCostUsd,
            providerRef: args.promptMessageId,
            usage,
            idempotencyKey: `chat:${args.reservationKey}`,
          });
        },
      );

      // Stream-phase errors are handled by the Agent itself: its internal
      // onError finalizes the pending assistant message as "failed" (or
      // materializes partial output) and marks the stream "aborted". Our
      // onError callback runs after that cleanup, so it tells us whether
      // the failure belongs to the stream phase.
      const result = await billingAgent.streamText(
        ctx,
        { threadId: args.threadId },
        {
          promptMessageId: args.promptMessageId,
          messages: attachmentMessages,
          model: fileParserModel,
          onError: () => {
            streamState.finalizedByAgent = true;
          },
        },
        { saveStreamDeltas: true },
      );
      if (result.order !== undefined) {
        await ctx.runMutation(internal.credits.recordReservationProviderRef, {
          reservationId: args.reservationId,
          providerRef: args.promptMessageId,
          order: result.order,
        });
      }
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
      await releaseCustomToolHolds("generate_reply_finished");
      await ctx.runMutation(internal.credits.enqueueSettlement, {
        reservationId: args.reservationId,
        userId: args.userId,
        providerCostUsd,
        providerRef: args.promptMessageId,
        usage: { promptMessageId: args.promptMessageId, status: turnStatus },
        idempotencyKey: `chat:${args.reservationKey}`,
      });
      await ctx.runMutation(internal.credits.settleReservation, {
        reservationId: args.reservationId,
        providerCostUsd,
        providerRef: args.promptMessageId,
        usage: { promptMessageId: args.promptMessageId, status: turnStatus },
        idempotencyKey: `chat:${args.reservationKey}`,
      });
    }
  },
});

export const generateThreadTitle = internalAction({
  args: {
    threadId: v.string(),
    promptText: v.string(),
    promptMessageId: v.optional(v.string()),
    expectedPrompt: v.optional(v.string()),
    reservationId: v.optional(v.id("usageReservations")),
  },
  handler: async (ctx, args) => {
    await maybeGenerateTitle(ctx, {
      threadId: args.threadId,
      promptText: args.promptText,
      promptMessageId: args.promptMessageId,
      expectedPrompt: args.expectedPrompt,
      reservationId: args.reservationId,
    });
  },
});

const GREETING_ONLY =
  /^(hi|hello|hey|hey there|hi there|good morning|good afternoon|good evening|yo|hola|thanks|thank you|ok|okay|yes|hmm|dear sir|dear ma|how far)[!.]*$/i;

type MaybeGenerateTitleArgs = {
  threadId: string;
  promptText: string;
  promptMessageId?: string;
  expectedPrompt?: string;
  reservationId?: Id<"usageReservations">;
};

async function maybeGenerateTitle(
  ctx: ActionCtx,
  args: MaybeGenerateTitleArgs,
): Promise<void> {
  const { threadId, promptText, reservationId } = args;
  try {
    if (reservationId) {
      const reservation = await ctx.runQuery(internal.credits.getReservation, {
        reservationId,
      });
      if (!reservation || reservation.status !== "active") return;
    }

    const metadata = await getThreadMetadata(ctx, components.agent, {
      threadId,
    });
    if (metadata.title) {
      if (reservationId) {
        await ctx.runMutation(internal.credits.releaseReservation, {
          reservationId,
          reason: "title_already_exists",
        });
      }
      return;
    }

    const fallback = promptText.slice(0, 50).trim() || "New chat";

    // Skip the LLM call on trivial inputs (greeting / <3 words) — the
    // truncation fallback is a perfectly good title here.
    const wordCount = promptText.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 3 || GREETING_ONLY.test(promptText.trim())) {
      await applyTitle(ctx, args, fallback);
      if (reservationId) {
        await ctx.runMutation(internal.credits.releaseReservation, {
          reservationId,
          reason: "title_skipped",
        });
      }
      return;
    }

    const contextText = `User: ${promptText.slice(0, 1000)}`;

    let title = fallback;
    let costUsd = 0;
    try {
      const generated = await generateTitleText(contextText);
      title = cleanTitle(generated.text, fallback);
      costUsd = generated.costUsd;
    } catch {
      // Keep the fallback title if both attempts fail.
    }

    const applied = await applyTitle(ctx, args, title);
    if (applied && reservationId) {
      const reservation = await ctx.runQuery(internal.credits.getReservation, {
        reservationId,
      });
      if (reservation?.status === "active") {
        await ctx.runMutation(internal.credits.enqueueSettlement, {
          reservationId,
          userId: reservation.userId,
          providerCostUsd: costUsd,
          usage: { operation: "title" },
          idempotencyKey: `title:${reservationId}`,
        });
        await ctx.runMutation(internal.credits.settleReservation, {
          reservationId,
          providerCostUsd: costUsd,
          usage: { operation: "title" },
          idempotencyKey: `title:${reservationId}`,
        });
      }
    }
  } catch (error) {
    console.error("title generation failed", error);
    if (reservationId) {
      await ctx.runMutation(internal.credits.releaseReservation, {
        reservationId,
        reason: "title_failed",
      }).catch(() => undefined);
    }
  }
}

async function generateTitleText(
  contextText: string,
): Promise<{ text: string; costUsd: number }> {
  const modelName = process.env.AI_MODEL;
  if (!modelName) {
    throw new Error("AI_MODEL is not set");
  }
  const model = openrouter.chat(modelName);
  const result = await generateText({
    model,
    instructions: TITLE_INSTRUCTIONS,
    prompt: contextText.slice(0, 2000),
    temperature: 0.2,
    providerOptions: {
      openrouter: { reasoning: { maxTokens: 0 } },
    },
  }).catch(async () =>
    await generateText({
      model,
      instructions: TITLE_INSTRUCTIONS,
      prompt: contextText.slice(0, 2000),
      temperature: 0.2,
    }),
  );
  if (!result.text) throw new Error("empty title output");
  return {
    text: result.text,
    costUsd: openRouterChargeUsd(result.usage, result.providerMetadata),
  };
}

// Non-destructive write: re-check the title right before applying so a
// concurrently generated/manual title always wins (industry setTitleIfNull).
async function applyTitle(
  ctx: ActionCtx,
  args: MaybeGenerateTitleArgs,
  title: string,
): Promise<boolean> {
  const applied = await ctx.runMutation(internal.chat.applyThreadTitle, {
    threadId: args.threadId,
    title,
    promptMessageId: args.promptMessageId,
    expectedPrompt: args.expectedPrompt,
    reservationId: args.reservationId,
  });
  if (!applied && args.reservationId) {
    await ctx
      .runMutation(internal.credits.releaseReservation, {
        reservationId: args.reservationId,
        reason: "title_not_applied",
      })
      .catch(() => undefined);
  }
  return applied;
}
