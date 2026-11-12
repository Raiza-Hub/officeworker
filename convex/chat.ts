import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
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
import { notifications } from "./notification_client";

const MAX_TITLE_PROMPT_CHARS = 2000;

async function authorizeThreadAccess(
  ctx: MutationCtx | QueryCtx,
  threadId: string,
  cacheScope?: string,
): Promise<void> {
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
}

// New chat: create thread + save the first user message + schedule generation.
// The client redirects to /agent/[threadId] immediately; the reply streams in.
export const startThread = mutation({
  args: {
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
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!wallet || wallet.balance <= 0) {
      throw new Error("Your wallet is empty. Add credits in Billing to start a chat.");
    }
    const prompt = args.prompt.trim();
    if (!prompt && (!args.attachments || args.attachments.length === 0)) {
      throw new Error("Message is empty");
    }

    const threadId = await createThread(ctx, components.agent, { userId });
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });
    await ctx.db.insert("threadActivity", {
      userId,
      threadId,
      lastActivityAt: Date.now(),
    });
    await Promise.all(
      (args.attachments ?? []).map((attachment) =>
        ctx.db.insert("messageAttachments", {
          messageId,
          threadId,
          key: attachment.key,
          name: attachment.name,
          mediaType: attachment.mediaType,
          size: attachment.size,
        }),
      ),
    );
    await ctx.scheduler.runAfter(0, internal.chatActions.generateThreadTitle, {
      threadId,
      promptText: prompt.slice(0, MAX_TITLE_PROMPT_CHARS),
    });
    await ctx.scheduler.runAfter(0, internal.chatActions.generateReply, {
      threadId,
      promptMessageId: messageId,
      attachments: args.attachments ?? [],
    });
    return { threadId, messageId };
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
    await authorizeThreadAccess(ctx, args.threadId);
    const prompt = args.prompt.trim();
    if (!prompt && (!args.attachments || args.attachments.length === 0)) {
      throw new Error("Message is empty");
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      prompt,
    });
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
    const activity = await ctx.db
      .query("threadActivity")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
    if (activity !== null) {
      await ctx.db.patch(activity._id, { lastActivityAt: Date.now() });
    }
    await ctx.scheduler.runAfter(0, internal.chatActions.generateReply, {
      threadId: args.threadId,
      promptMessageId: messageId,
      attachments: args.attachments ?? [],
    });
    return { messageId };
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

type MessageAttachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

async function joinAttachments<T extends { id: string }>(
  ctx: QueryCtx,
  page: T[],
): Promise<Array<T & { attachments: MessageAttachment[] }>> {
  const attachmentsById = await Promise.all(
    page.map((item) =>
      ctx.db
        .query("messageAttachments")
        .withIndex("by_message", (q) => q.eq("messageId", item.id))
        .collect(),
    ),
  );
  const attachmentsByMessageId = new Map<string, MessageAttachment[]>();
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

// Chat history for /activity — threads by recent activity.
export const listThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db
      .query("threadActivity")
      .withIndex("by_user_activity", (q) => q.eq("userId", userId))
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
    if (args.status === "cancelled") return;

    const activity = await ctx.db
      .query("threadActivity")
      .withIndex("by_thread", (q) => q.eq("threadId", timing.threadId))
      .first();
    if (!activity) return;
    const title = activity.title?.trim() || "your chat";
    const kind = args.status === "completed" ? "agent_reply" : "action_required";
    await notifications.create(ctx, {
      targetId: timing.userId,
      kind,
      data: {
        title:
          args.status === "completed" ? "The agent replied" : "The agent needs attention",
        body:
          args.status === "completed"
            ? `There’s a new response in ${title}.`
            : `The response in ${title} did not finish. Open the chat to retry.`,
        href: `/agent/${timing.threadId}`,
      },
      source: { type: "chat", id: timing.threadId },
      dedupeKey: `agent-turn:${args.promptMessageId}:${args.status}`,
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
