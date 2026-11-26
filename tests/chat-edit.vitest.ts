process.env.AI_MODEL = "test-model";

import { createThread, saveMessage } from "@convex-dev/agent";
import componentTest from "@convex-dev/agent/test";
import { ConvexError } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, components, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { BILLING_CONFIG } from "../lib/billing";

const modules = import.meta.glob("../convex/**/*.ts");

type Test = TestConvex<typeof schema>;

afterEach(() => {
  vi.useRealTimers();
});

async function patchMessageExternalId(t: Test, messageId: string) {
  await (t as unknown as {
    runInComponent: (
      name: string,
      fn: (ctx: {
        db: { patch: (table: string, id: string, patch: object) => Promise<void> };
      }) => Promise<void>,
    ) => Promise<void>;
  }).runInComponent("agent", async (ctx) => {
    await ctx.db.patch("messages", messageId, { id: messageId });
  });
}

async function seedPrompt(
  t: Test,
  threadId: string,
  userId: string,
  prompt: string,
  order: number,
) {
  const { messageId } = await t.mutation(async (ctx) =>
    await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      prompt,
      order,
    }),
  );
  await patchMessageExternalId(t, messageId);
  return messageId;
}

async function seedAttachment(
  t: Test,
  threadId: string,
  messageId: string,
  attachment: { key: string; name: string; mediaType: string; size: number },
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("messageAttachments", {
      messageId,
      threadId,
      ...attachment,
    });
  });
}

async function seedGeneratedMessages(
  t: Test,
  threadId: string,
  userId: string,
  promptMessageId: string,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    const messageId = await t.mutation(async (ctx) =>
      (
        await saveMessage(ctx, components.agent, {
          threadId,
          userId,
          promptMessageId,
          message: { role: "assistant", content: `generated ${index}` },
        })
      ).messageId,
    );
    await patchMessageExternalId(t, messageId);
  }
}

async function getThreadTitle(t: Test, threadId: string) {
  return await t.query(components.agent.threads.getThread, { threadId });
}

async function seedTitleReservation(
  t: Test,
  userId: string,
  threadId: string,
  messageId: string,
) {
  const reservationId = await t.mutation(internal.credits.reserveCredits, {
    userId: userId as never,
    key: `title:${threadId}:${messageId}`,
    operation: "title",
    amountKobo: BILLING_CONFIG.titleCapKobo,
    scopeKey: `thread:${threadId}`,
    metadata: { threadId },
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(reservationId, { providerRef: messageId });
  });
  return reservationId;
}

async function seedEditorThread(prompt = "original prompt") {
  const t = convexTest(schema, modules);
  componentTest.register(t, "agent");

  const userId = await t.run(async (ctx) =>
    await ctx.db.insert("users", {
      name: "Editor",
      email: "editor@example.com",
      emailVerificationTime: Date.now(),
    }),
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("wallets", {
      userId,
      plan: "basic",
      balance: 10_000,
      reserved: 0,
      balanceKobo: 1_000_000,
      reservedKobo: 0,
      updatedAt: Date.now(),
    });
  });

  const threadId = await t.mutation(async (ctx) =>
    await createThread(ctx, components.agent, { userId }),
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("threadActivity", {
      userId,
      threadId,
      status: "active",
      lastActivityAt: Date.now(),
    });
  });

  const messageId = await seedPrompt(t, threadId, userId, prompt, 0);

  return {
    t,
    userId,
    threadId,
    messageId,
    authed: t.withIdentity({ subject: userId }),
  };
}

describe("chat message editing", () => {
  test("editing removes every generated message in the target turn", async () => {
    const { t, authed, userId, threadId, messageId } = await seedEditorThread(
      "old prompt",
    );
    await seedGeneratedMessages(t, threadId, userId, messageId, 70);
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "replacement prompt",
    });

    const page = await t.query(components.agent.messages.listMessagesByThreadId, {
      threadId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 1000 },
    });
    expect(page.page.filter((message) => message.text?.startsWith("generated"))).toEqual([]);
  });

  test("a released title reservation cannot apply a generated title", async () => {
    const { t, userId, threadId, messageId } = await seedEditorThread(
      "first prompt",
    );
    const reservationId = await seedTitleReservation(
      t,
      userId,
      threadId,
      messageId,
    );
    await t.mutation(internal.credits.releaseReservation, {
      reservationId,
      reason: "message_edited",
    });

    await t.mutation(internal.chat.applyThreadTitle, {
      threadId,
      title: "Stale title",
      reservationId,
      promptMessageId: messageId,
    });

    const metadata = await getThreadTitle(t, threadId);
    expect(metadata?.title).toBeUndefined();
  });

  test("editing the first prompt regenerates its title", async () => {
    const { t, authed, userId, threadId, messageId } = await seedEditorThread(
      "first prompt",
    );
    const reservationId = await seedTitleReservation(
      t,
      userId,
      threadId,
      messageId,
    );
    await t.mutation(internal.chat.applyThreadTitle, {
      threadId,
      title: "Old title",
      reservationId,
      promptMessageId: messageId,
    });
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "replacement prompt",
    });

    const metadata = await getThreadTitle(t, threadId);
    expect(metadata?.title).toBe("");
    const staleReservation = await t.run(
      async (ctx) => await ctx.db.get(reservationId),
    );
    expect(staleReservation?.status).toBe("released");
  });

  test("editor can change the text of a sent prompt", async () => {
    const { authed, userId, threadId, messageId } = await seedEditorThread();
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "edited prompt",
    });

    const page = await authed.query(api.chat.listThreadMessagesPage, {
      threadId,
      cacheScope: userId,
      cursor: null,
    });
    expect(page.page.map((message) => message.text)).toContain("edited prompt");
  });

  test("editor can discard later turns when saving an edit", async () => {
    const { t, authed, userId, threadId, messageId } = await seedEditorThread(
      "old prompt",
    );
    await seedPrompt(t, threadId, userId, "later prompt", 1);
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "replacement prompt",
    });

    const page = await authed.query(api.chat.listThreadMessagesPage, {
      threadId,
      cacheScope: userId,
      cursor: null,
    });
    expect(page.page.map((message) => message.text)).not.toContain(
      "later prompt",
    );
  });

  test("unchanged attachments survive an edit", async () => {
    const { t, authed, userId, threadId, messageId } = await seedEditorThread();
    const attachment = {
      key: "file-1",
      name: "notes.txt",
      mediaType: "text/plain",
      size: 12,
    };
    await seedAttachment(t, threadId, messageId, attachment);
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "edited with attachment",
      attachments: [attachment],
    });

    const page = await authed.query(api.chat.listThreadMessagesPage, {
      threadId,
      cacheScope: userId,
      cursor: null,
    });
    expect(page.page.flatMap((message) => message.attachments)).toEqual([
      attachment,
    ]);
  });

  test("editor can remove an attachment during an edit", async () => {
    const { t, authed, userId, threadId, messageId } = await seedEditorThread();
    const kept = {
      key: "file-1",
      name: "kept.txt",
      mediaType: "text/plain",
      size: 4,
    };
    const removed = {
      key: "file-2",
      name: "removed.txt",
      mediaType: "text/plain",
      size: 7,
    };
    await seedAttachment(t, threadId, messageId, kept);
    await seedAttachment(t, threadId, messageId, removed);
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "edited prompt",
      attachments: [kept],
    });

    const page = await authed.query(api.chat.listThreadMessagesPage, {
      threadId,
      cacheScope: userId,
      cursor: null,
    });
    expect(page.page.flatMap((message) => message.attachments)).toEqual([kept]);
  });

  test("editor can change attachment metadata during an edit", async () => {
    const { t, authed, userId, threadId, messageId } = await seedEditorThread();
    const attachment = {
      key: "file-1",
      name: "old.txt",
      mediaType: "text/plain",
      size: 12,
    };
    const changed = {
      key: "file-1",
      name: "new.txt",
      mediaType: "text/plain",
      size: 24,
    };
    await seedAttachment(t, threadId, messageId, attachment);
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "edited prompt",
      attachments: [changed],
    });

    const page = await authed.query(api.chat.listThreadMessagesPage, {
      threadId,
      cacheScope: userId,
      cursor: null,
    });
    expect(page.page.flatMap((message) => message.attachments)).toEqual([changed]);
  });

  test("editor can add a new attachment during an edit", async () => {
    const { authed, userId, threadId, messageId } = await seedEditorThread();
    const added = {
      key: "file-1",
      name: "added.txt",
      mediaType: "text/plain",
      size: 5,
    };
    vi.useFakeTimers();

    await authed.mutation(api.chat.editMessage, {
      threadId,
      messageId,
      prompt: "edited prompt",
      attachments: [added],
    });

    const page = await authed.query(api.chat.listThreadMessagesPage, {
      threadId,
      cacheScope: userId,
      cursor: null,
    });
    expect(page.page.flatMap((message) => message.attachments)).toEqual([added]);
  });

  test("sendMessage rejects before saving when the wallet is empty", async () => {
    const t = convexTest(schema, modules);
    componentTest.register(t, "agent");
    const userId = await t.run(async (ctx) =>
      await ctx.db.insert("users", {
        name: "No Credits",
        email: "no-credits@example.com",
        emailVerificationTime: Date.now(),
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("wallets", {
        userId,
        plan: "basic",
        balance: 0,
        reserved: 0,
        balanceKobo: 0,
        reservedKobo: 0,
        updatedAt: Date.now(),
      });
    });
    const threadId = await t.mutation(async (ctx) =>
      await createThread(ctx, components.agent, { userId }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("threadActivity", {
        userId,
        threadId,
        status: "draft",
        lastActivityAt: Date.now(),
      });
    });

    let code: string | undefined;
    try {
      await t.withIdentity({ subject: userId }).mutation(api.chat.sendMessage, {
        threadId,
        prompt: "hello",
      });
    } catch (error) {
      if (error instanceof ConvexError) {
        code = (error.data as { code?: string }).code;
      }
    }
    expect(code).toBe("WALLET_EMPTY");
  });
});
