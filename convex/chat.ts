import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import {
  abortStream,
  createThread,
  getThreadMetadata,
  listUIMessages,
  saveMessage,
  syncStreams,
  updateThreadMetadata,
  vStreamArgs,
} from "@convex-dev/agent";
import { agent } from "./agent";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  releaseReservationCore,
  releaseReservationsCore,
  reserveCreditsCore,
  reserveCustomToolHoldsCore,
} from "./credits";
import { isSpreadsheetAttachment } from "../lib/attachments";
import { BILLING_CONFIG } from "../lib/billing";

const MAX_TITLE_PROMPT_CHARS = 2000;

type ChatAttachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

type AgentMessageRow = {
  id?: string;
  order?: number;
  stepOrder?: number;
  role?: string;
  text?: string;
  message?: { role?: string; content?: unknown };
  status?: string;
};

function agentMessageRole(message: AgentMessageRow) {
  return message.role ?? message.message?.role;
}

function agentMessageText(message: AgentMessageRow) {
  if (typeof message.text === "string") return message.text;
  const content = message.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part !== "object" || part === null || !("text" in part)) {
        return "";
      }
      return typeof part.text === "string" ? part.text : "";
    })
    .join("");
}

async function listThreadAgentMessages(
  ctx: MutationCtx,
  threadId: string,
): Promise<AgentMessageRow[]> {
  const messages: AgentMessageRow[] = [];
  let cursor: string | null = null;
  while (true) {
    const page: {
      page: AgentMessageRow[];
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
      threadId,
      order: "asc",
      paginationOpts: { cursor, numItems: 1000 },
    });
    messages.push(...page.page);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  return messages;
}

async function ensureChatTurnReserved(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    threadId: string;
    prompt: string;
    attachments: ChatAttachment[];
    reservationKey: string;
    withTitle: boolean;
  },
) {
  const chatHoldKobo =
    BILLING_CONFIG.chatTurnCapKobo +
    (hasPdfAttachment(args.attachments) ? BILLING_CONFIG.pdfCapKobo : 0);
  const chatReservationId = await reserveCreditsCore(ctx, {
    userId: args.userId,
    key: args.reservationKey,
    operation: "chat",
    amountKobo: chatHoldKobo,
    scopeKey: `thread:${args.threadId}`,
    metadata: { threadId: args.threadId, prompt: args.prompt.slice(0, 200) },
  });

  let titleReservationId: Id<"usageReservations"> | undefined;
  if (args.withTitle) {
    try {
      titleReservationId = await reserveCreditsCore(ctx, {
        userId: args.userId,
        key: `title:${args.reservationKey}`,
        operation: "title",
        amountKobo: BILLING_CONFIG.titleCapKobo,
        scopeKey: `thread:${args.threadId}`,
        metadata: { threadId: args.threadId },
      });
    } catch (error) {
      await releaseReservationCore(ctx, chatReservationId, "title_reservation_failed");
      throw error;
    }
  }
  return { chatReservationId, titleReservationId, chatHoldKobo };
}

async function reserveSpreadsheetHoldsCore(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    threadId: string;
    promptMessageId: string;
    attachments: ChatAttachment[];
    keyPrefix: string;
  },
) {
  const seenAttachmentKeys = new Set<string>();
  const spreadsheetHolds: Array<{
    attachmentKey: string;
    hold: {
      key: string;
      scopeKey: string;
      metadata: {
        threadId: string;
        promptMessageId: string;
        toolName: string;
        attachmentKey: string;
      };
      providerRef: string;
    };
  }> = [];
  for (const attachment of args.attachments) {
    if (
      !isSpreadsheetAttachment(attachment) ||
      seenAttachmentKeys.has(attachment.key)
    ) {
      continue;
    }
    seenAttachmentKeys.add(attachment.key);
    spreadsheetHolds.push({
      attachmentKey: attachment.key,
      hold: {
        key: `custom_tool:spreadsheet:${args.keyPrefix}:${attachment.key}`,
        scopeKey: `thread:${args.threadId}`,
        metadata: {
          threadId: args.threadId,
          promptMessageId: args.promptMessageId,
          toolName: "spreadsheet_parse",
          attachmentKey: attachment.key,
        },
        providerRef: args.promptMessageId,
      },
    });
  }
  if (spreadsheetHolds.length === 0) return [];
  const reservationIds = await reserveCustomToolHoldsCore(
    ctx,
    args.userId,
    spreadsheetHolds.map((entry) => entry.hold),
  );
  return spreadsheetHolds.map((entry, index) => ({
    reservationId: reservationIds[index]!,
    attachmentKey: entry.attachmentKey,
  }));
}

async function clearThreadTitle(ctx: MutationCtx, threadId: string) {
  const metadata = await getThreadMetadata(ctx, components.agent, { threadId });
  if (metadata.title) {
    await updateThreadMetadata(ctx, components.agent, {
      threadId,
      patch: { title: "" },
    });
  }
  const rows = await ctx.db
    .query("threadActivity")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .collect();
  await Promise.all(rows.map((row) => ctx.db.patch(row._id, { title: "" })));
}

async function deleteMessageRangeInBatches(
  ctx: MutationCtx,
  args: {
    threadId: string;
    startOrder: number;
    startStepOrder: number;
    endOrder: number;
  },
) {
  let startOrder = args.startOrder;
  let startStepOrder = args.startStepOrder;
  while (true) {
    const result = await agent.deleteMessageRange(ctx, {
      threadId: args.threadId,
      startOrder,
      startStepOrder,
      endOrder: args.endOrder,
    });
    if (result.isDone || result.lastOrder === undefined) return;
    startOrder = result.lastOrder;
    startStepOrder = result.lastStepOrder ?? 0;
  }
}

async function deleteMessagesAfterOrder(
  ctx: MutationCtx,
  threadId: string,
  order: number,
) {
  await deleteMessageRangeInBatches(ctx, {
    threadId,
    startOrder: order,
    startStepOrder: 1,
    endOrder: order + 1,
  });
  await deleteMessageRangeInBatches(ctx, {
    threadId,
    startOrder: order + 1,
    startStepOrder: 0,
    endOrder: Number.MAX_SAFE_INTEGER,
  });
}

function hasPdfAttachment(attachments: ChatAttachment[]): boolean {
  return attachments.some(
    (attachment) =>
      attachment.mediaType === "application/pdf" ||
      /\.pdf$/i.test(attachment.name),
  );
}

async function authorizeThreadAccess(
  ctx: MutationCtx | QueryCtx,
  threadId: string,
  cacheScope?: string,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  if (cacheScope !== undefined && cacheScope !== userId) {
    throw new Error("Thread not found");
  }
  const activity = await ctx.db
    .query("threadActivity")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .first();
  if (activity === null || activity.userId !== userId) {
    throw new Error("Thread not found");
  }
  return userId;
}

// Hidden draft created as soon as the user starts a new chat. The first real
// send promotes it to an active thread and schedules title + reply generation.
export const createDraftThread = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("threadActivity")
      .withIndex("by_user_status_activity", (q) =>
        q.eq("userId", userId).eq("status", "draft"),
      )
      .order("desc")
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastActivityAt: Date.now() });
      return { threadId: existing.threadId };
    }

    const threadId = await createThread(ctx, components.agent, { userId });
    await ctx.db.insert("threadActivity", {
      userId,
      threadId,
      status: "draft",
      title: "",
      lastActivityAt: Date.now(),
    });
    return { threadId };
  },
});

// Existing chat: append a user message and schedule generation.
export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          key: v.string(),
          name: v.string(),
          mediaType: v.string(),
          size: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await authorizeThreadAccess(ctx, args.threadId);
    const activity = await ctx.db
      .query("threadActivity")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
    const isFirstMessage = activity?.status === "draft";
    const prompt = args.prompt.trim();
    if (!prompt && (!args.attachments || args.attachments.length === 0)) {
      throw new Error("Message is empty");
    }

    const chatReservationKey = `chat:${crypto.randomUUID()}`;
    const { chatReservationId, titleReservationId, chatHoldKobo } =
      await ensureChatTurnReserved(ctx, {
        userId,
        threadId: args.threadId,
        prompt,
        attachments: args.attachments ?? [],
        reservationKey: chatReservationKey,
        withTitle: isFirstMessage,
      });

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      prompt,
    });
    await ctx.db.patch(chatReservationId, { providerRef: messageId });
    if (titleReservationId) {
      await ctx.db.patch(titleReservationId, { providerRef: messageId });
    }

    let customToolHolds: Array<{
      reservationId: Id<"usageReservations">;
      attachmentKey: string;
    }> = [];
    try {
      customToolHolds = await reserveSpreadsheetHoldsCore(ctx, {
        userId,
        threadId: args.threadId,
        promptMessageId: messageId,
        attachments: args.attachments ?? [],
        keyPrefix: messageId,
      });
    } catch (error) {
      await releaseReservationsCore(
        ctx,
        [
          chatReservationId,
          ...(titleReservationId ? [titleReservationId] : []),
          ...customToolHolds.map((hold) => hold.reservationId),
        ],
        "spreadsheet_reservation_failed",
      );
      throw error;
    }

    await Promise.all(
      (args.attachments ?? []).map((attachment) =>
        ctx.db.insert("messageAttachments", {
          messageId,
          threadId: args.threadId,
          key: attachment.key,
          name: attachment.name,
          mediaType: attachment.mediaType,
          size: attachment.size,
        }),
      ),
    );
    if (activity !== null) {
      await ctx.db.patch(activity._id, {
        status: "active",
        lastActivityAt: Date.now(),
      });
    }
    if (isFirstMessage) {
      const titleJobId = await ctx.scheduler.runAfter(
        0,
        internal.chatActions.generateThreadTitle,
        {
          threadId: args.threadId,
          promptText: prompt.slice(0, MAX_TITLE_PROMPT_CHARS),
          promptMessageId: messageId,
          expectedPrompt: prompt,
          reservationId: titleReservationId,
        },
      );
      if (titleReservationId) {
        await ctx.db.patch(titleReservationId, {
          metadata: { threadId: args.threadId, titleJobId },
        });
      }
    }

    await ctx.scheduler.runAfter(0, internal.chatActions.generateReply, {
      userId,
      threadId: args.threadId,
      promptMessageId: messageId,
      attachments: args.attachments ?? [],
      reservationId: chatReservationId,
      reservationKey: chatReservationKey,
      holdKobo: chatHoldKobo,
      customToolHolds,
    });
    return { messageId };
  },
});

export const editMessage = mutation({
  args: {
    threadId: v.string(),
    messageId: v.string(),
    prompt: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          key: v.string(),
          name: v.string(),
          mediaType: v.string(),
          size: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await authorizeThreadAccess(ctx, args.threadId);
    const prompt = args.prompt.trim();
    const attachments = args.attachments ?? [];
    if (!prompt && attachments.length === 0) {
      throw new Error("Message is empty");
    }

    const messages = await listThreadAgentMessages(ctx, args.threadId);
    const target = messages.find((message) => message.id === args.messageId);
    const targetOrder = target?.order;
    if (!target || agentMessageRole(target) !== "user" || targetOrder === undefined) {
      throw new Error("Message not found");
    }

    const deletedMessages = messages.filter((message) => {
      if (typeof message.order !== "number") return false;
      return (
        message.order > targetOrder ||
        (message.order === targetOrder && (message.stepOrder ?? 0) > 0)
      );
    });
    const deletedIds = new Set(
      deletedMessages
        .map((message) => message.id)
        .filter((id): id is string => typeof id === "string"),
    );
    const deletedPromptIds = new Set(
      deletedMessages
        .filter((message) => agentMessageRole(message) === "user")
        .map((message) => message.id)
        .filter((id): id is string => typeof id === "string"),
    );

    const timings = await ctx.db
      .query("assistantTurnTimings")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    const runningPromptIds = new Set(
      timings
        .filter((timing) => timing.status === "running")
        .map((timing) => timing.promptMessageId),
    );
    const messageOrderById = new Map<string, number>();
    for (const message of messages) {
      if (typeof message.id === "string" && typeof message.order === "number") {
        messageOrderById.set(message.id, message.order);
      }
    }
    for (const promptMessageId of [args.messageId, ...deletedPromptIds]) {
      if (!runningPromptIds.has(promptMessageId)) continue;
      const order = messageOrderById.get(promptMessageId);
      if (order === undefined) continue;
      await Promise.all([
        abortStream(ctx, components.agent, {
          threadId: args.threadId,
          order,
          reason: "Message edited",
        }),
      ]);
    }

    const firstPromptOrder = Math.min(
      ...messages
        .filter((message) => agentMessageRole(message) === "user")
        .map((message) => message.order ?? Number.MAX_SAFE_INTEGER),
    );
    const isFirstPrompt = targetOrder === firstPromptOrder;
    const editedPromptIds = new Set([args.messageId, ...deletedPromptIds]);
    const finishedAt = Date.now();
    await Promise.all(
      timings
        .filter((timing) => editedPromptIds.has(timing.promptMessageId))
        .map((timing) =>
          ctx.db.patch(timing._id, {
            finishedAt,
            durationMs: Math.max(0, finishedAt - timing.startedAt),
            status: "cancelled",
          }),
        ),
    );

    const activeReservations = await ctx.db
      .query("usageReservations")
      .withIndex("by_scope_status", (q) =>
        q.eq("scopeKey", `thread:${args.threadId}`).eq("status", "active"),
      )
      .collect();
    const staleReservations = activeReservations.filter(
      (reservation) =>
        reservation.providerRef !== undefined &&
        editedPromptIds.has(reservation.providerRef) &&
        ["chat", "title", "custom_tool"].includes(reservation.operation),
    );
    if (staleReservations.length > 0) {
      await releaseReservationsCore(
        ctx,
        staleReservations.map((reservation) => reservation._id),
        "message_edited",
      );
    }
    await Promise.all(
      staleReservations
        .filter((reservation) => reservation.operation === "title")
        .map((reservation) =>
          (reservation.metadata as { titleJobId?: string } | null)?.titleJobId,
        )
        .filter((jobId): jobId is string => jobId !== undefined)
        .map(async (jobId) => {
          try {
            await ctx.scheduler.cancel(jobId as Id<"_scheduled_functions">);
          } catch {}
        }),
    );

    await agent.updateMessage(ctx, {
      messageId: args.messageId,
      patch: {
        message: { role: "user", content: prompt },
        status: "success",
      },
    });

    await deleteMessagesAfterOrder(ctx, args.threadId, targetOrder);

    if (deletedIds.size > 0) {
      const attachmentRows = await ctx.db
        .query("messageAttachments")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .collect();
      await Promise.all(
        attachmentRows
          .filter((row) => deletedIds.has(row.messageId))
          .map((row) => ctx.db.delete(row._id)),
      );
    }

    const existingAttachmentRows = await ctx.db
      .query("messageAttachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    const existingAttachmentKeys = new Set(
      existingAttachmentRows.map((row) => row.key),
    );
    const submittedAttachmentsByKey = new Map(
      attachments.map((attachment) => [attachment.key, attachment]),
    );
    const attachmentWrites: Promise<unknown>[] = [];
    for (const row of existingAttachmentRows) {
      const submitted = submittedAttachmentsByKey.get(row.key);
      if (!submitted) {
        attachmentWrites.push(ctx.db.delete(row._id));
        continue;
      }
      if (
        row.name !== submitted.name ||
        row.mediaType !== submitted.mediaType ||
        row.size !== submitted.size
      ) {
        attachmentWrites.push(
          ctx.db.patch(row._id, {
            name: submitted.name,
            mediaType: submitted.mediaType,
            size: submitted.size,
          }),
        );
      }
    }
    await Promise.all(attachmentWrites);
    await Promise.all(
      attachments
        .filter((attachment) => !existingAttachmentKeys.has(attachment.key))
        .map((attachment) =>
          ctx.db.insert("messageAttachments", {
            messageId: args.messageId,
            threadId: args.threadId,
            key: attachment.key,
            name: attachment.name,
            mediaType: attachment.mediaType,
            size: attachment.size,
          }),
        ),
    );

    const chatReservationKey = `chat:${crypto.randomUUID()}`;
    const { chatReservationId, titleReservationId, chatHoldKobo } =
      await ensureChatTurnReserved(ctx, {
        userId,
        threadId: args.threadId,
        prompt,
        attachments,
        reservationKey: chatReservationKey,
        withTitle: isFirstPrompt,
      });
    await ctx.db.patch(chatReservationId, { providerRef: args.messageId });
    if (titleReservationId) {
      await ctx.db.patch(titleReservationId, { providerRef: args.messageId });
    }
    if (isFirstPrompt) {
      await clearThreadTitle(ctx, args.threadId);
    }

    let customToolHolds: Array<{
      reservationId: Id<"usageReservations">;
      attachmentKey: string;
    }> = [];
    try {
      customToolHolds = await reserveSpreadsheetHoldsCore(ctx, {
        userId,
        threadId: args.threadId,
        promptMessageId: args.messageId,
        attachments,
        keyPrefix: chatReservationKey,
      });
    } catch (error) {
      await releaseReservationCore(ctx, chatReservationId, "spreadsheet_reservation_failed");
      throw error;
    }

    const activity = await ctx.db
      .query("threadActivity")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
    if (activity) {
      await ctx.db.patch(activity._id, {
        status: "active",
        lastActivityAt: Date.now(),
      });
    }

    if (isFirstPrompt) {
      const titleJobId = await ctx.scheduler.runAfter(
        0,
        internal.chatActions.generateThreadTitle,
        {
          threadId: args.threadId,
          promptText: prompt.slice(0, MAX_TITLE_PROMPT_CHARS),
          promptMessageId: args.messageId,
          expectedPrompt: prompt,
          reservationId: titleReservationId,
        },
      );
      if (titleReservationId) {
        await ctx.db.patch(titleReservationId, {
          metadata: { threadId: args.threadId, titleJobId },
        });
      }
    }

    await ctx.scheduler.runAfter(0, internal.chatActions.generateReply, {
      userId,
      threadId: args.threadId,
      promptMessageId: args.messageId,
      attachments,
      reservationId: chatReservationId,
      reservationKey: chatReservationKey,
      holdKobo: chatHoldKobo,
      customToolHolds,
    });
    return { messageId: args.messageId };
  },
});

export const cancelGeneration = mutation({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, args.threadId);
    const timing = await ctx.db
      .query("assistantTurnTimings")
      .withIndex("by_prompt", (q) =>
        q.eq("promptMessageId", args.promptMessageId),
      )
      .first();
    if (
      !timing ||
      timing.threadId !== args.threadId ||
      timing.status !== "running"
    ) {
      return false;
    }

    const finishedAt = Date.now();
    await ctx.db.patch(timing._id, {
      finishedAt,
      durationMs: Math.max(0, finishedAt - timing.startedAt),
      status: "cancelled",
    });
    await abortStream(ctx, components.agent, {
      threadId: args.threadId,
      order: args.order,
      reason: "User cancelled",
    });
    const activeReservations = await ctx.db
      .query("usageReservations")
      .withIndex("by_scope_status", (q) =>
        q.eq("scopeKey", `thread:${args.threadId}`).eq("status", "active"),
      )
      .collect();
    const reservationIds = activeReservations
      .filter(
        (reservation) =>
          reservation.providerRef === args.promptMessageId &&
          ["chat", "title", "custom_tool"].includes(reservation.operation),
      )
      .map((reservation) => reservation._id);
    if (reservationIds.length > 0) {
      await releaseReservationsCore(ctx, reservationIds, "user_cancelled");
    }
    return true;
  },
});

export const isTurnCancelled = internalQuery({
  args: { promptMessageId: v.string() },
  handler: async (ctx, { promptMessageId }) => {
    const timing = await ctx.db
      .query("assistantTurnTimings")
      .withIndex("by_prompt", (q) => q.eq("promptMessageId", promptMessageId))
      .first();
    return timing?.status === "cancelled";
  },
});

async function joinAttachments<T extends { id: string }>(
  ctx: QueryCtx,
  page: T[],
): Promise<Array<T & { attachments: ChatAttachment[] }>> {
  const attachmentsById = await Promise.all(
    page.map((item) =>
      ctx.db
        .query("messageAttachments")
        .withIndex("by_message", (q) => q.eq("messageId", item.id))
        .collect(),
    ),
  );
  const attachmentsByMessageId = new Map<string, ChatAttachment[]>();
  for (const rows of attachmentsById) {
    for (const row of rows) {
      const list = attachmentsByMessageId.get(row.messageId) ?? [];
      list.push({
        key: row.key,
        name: row.name,
        mediaType: row.mediaType,
        size: row.size,
      });
      attachmentsByMessageId.set(row.messageId, list);
    }
  }
  return page.map((item) => ({
    ...item,
    attachments: attachmentsByMessageId.get(item.id) ?? [],
  }));
}

// UI messages for the chat page, with live stream deltas merged in and
// message attachments joined from the messageAttachments table.
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    cacheScope: v.id("users"),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, args.threadId, args.cacheScope);
    const [paginated, streams] = await Promise.all([
      listUIMessages(ctx, components.agent, args),
      syncStreams(ctx, components.agent, args),
    ]);

    const page = await joinAttachments(ctx, paginated.page);

    return { ...paginated, page, streams };
  },
});

export const listThreadMessagesPage = query({
  args: {
    threadId: v.string(),
    cacheScope: v.id("users"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, args.threadId, args.cacheScope);
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: { cursor: args.cursor, numItems: 30 },
    });
    return {
      ...paginated,
      page: await joinAttachments(ctx, paginated.page),
    };
  },
});

// Chat history — threads by recent activity.
export const listThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db
      .query("threadActivity")
      .withIndex("by_user_activity", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("status"), "draft"))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getThreadSummary = query({
  args: { threadId: v.string(), cacheScope: v.id("users") },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, args.threadId, args.cacheScope);
    const metadata = await getThreadMetadata(ctx, components.agent, {
      threadId: args.threadId,
    });
    return { title: metadata.title ?? null, createdAt: metadata._creationTime };
  },
});

export const listThreadTurnTimings = query({
  args: { threadId: v.string(), cacheScope: v.id("users") },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, args.threadId, args.cacheScope);
    return await ctx.db
      .query("assistantTurnTimings")
      .withIndex("by_user_thread", (q) =>
        q.eq("userId", args.cacheScope).eq("threadId", args.threadId),
      )
      .collect();
  },
});

export const recordTurnStarted = internalMutation({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db
      .query("threadActivity")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
    if (!activity) return null;
    const existing = await ctx.db
      .query("assistantTurnTimings")
      .withIndex("by_prompt", (q) => q.eq("promptMessageId", args.promptMessageId))
      .first();
    if (existing?.status === "cancelled") return null;
    const startedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: activity.userId,
        threadId: args.threadId,
        startedAt,
        finishedAt: undefined,
        durationMs: undefined,
        status: "running",
      });
    } else {
      await ctx.db.insert("assistantTurnTimings", {
        userId: activity.userId,
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
        startedAt,
        status: "running",
      });
    }
    return startedAt;
  },
});

export const recordTurnFinished = internalMutation({
  args: {
    promptMessageId: v.string(),
    finishedAt: v.number(),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    const timing = await ctx.db
      .query("assistantTurnTimings")
      .withIndex("by_prompt", (q) => q.eq("promptMessageId", args.promptMessageId))
      .first();
    if (!timing) return;
    if (timing.status === "cancelled") return;
    await ctx.db.patch(timing._id, {
      finishedAt: args.finishedAt,
      durationMs: Math.max(0, args.finishedAt - timing.startedAt),
      status: args.status,
    });
  },
});

export const deleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, args.threadId);
    await agent.deleteThreadAsync(ctx, { threadId: args.threadId });
    const [rows, attachmentRows, timingRows] = await Promise.all([
      ctx.db
        .query("threadActivity")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .collect(),
      ctx.db
        .query("messageAttachments")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .collect(),
      ctx.db
        .query("assistantTurnTimings")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .collect(),
    ]);
    await Promise.all(
      [...rows, ...attachmentRows, ...timingRows].map((row) =>
        ctx.db.delete(row._id),
      ),
    );
  },
});

export const renameThread = mutation({
  args: { threadId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, args.threadId);
    const title = args.title.trim().slice(0, 120);
    if (!title) throw new Error("Name cannot be empty");
    await updateThreadMetadata(ctx, components.agent, {
      threadId: args.threadId,
      patch: { title },
    });
    const rows = await ctx.db
      .query("threadActivity")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    await Promise.all(
      rows.map((row) => ctx.db.patch(row._id, { title })),
    );
  },
});

// Called by the title generator in chatActions.ts after the first reply.
export const setThreadTitle = internalMutation({
  args: { threadId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("threadActivity")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    await Promise.all(
      rows.map((row) => ctx.db.patch(row._id, { title: args.title })),
    );
  },
});

export const applyThreadTitle = internalMutation({
  args: {
    threadId: v.string(),
    title: v.string(),
    reservationId: v.optional(v.id("usageReservations")),
    promptMessageId: v.optional(v.string()),
    expectedPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.reservationId) {
      const reservation = await ctx.db.get(args.reservationId);
      if (!reservation || reservation.status !== "active") return false;
      if (
        args.promptMessageId &&
        reservation.providerRef !== args.promptMessageId
      ) {
        return false;
      }
    }

    if (args.promptMessageId && args.expectedPrompt !== undefined) {
      const messages = await listThreadAgentMessages(ctx, args.threadId);
      const prompt = messages.find(
        (message) =>
          message.id === args.promptMessageId &&
          agentMessageRole(message) === "user",
      );
      if (!prompt || agentMessageText(prompt) !== args.expectedPrompt) {
        return false;
      }
    }

    const metadata = await getThreadMetadata(ctx, components.agent, {
      threadId: args.threadId,
    });
    if (metadata.title) return false;
    await updateThreadMetadata(ctx, components.agent, {
      threadId: args.threadId,
      patch: { title: args.title },
    });
    await ctx.runMutation(internal.chat.setThreadTitle, {
      threadId: args.threadId,
      title: args.title,
    });
    return true;
  },
});
