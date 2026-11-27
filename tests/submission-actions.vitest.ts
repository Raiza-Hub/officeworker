import { convexTest, type TestConvex } from "convex-test";
import { v } from "convex/values";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { internalAction } from "../convex/_generated/server";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

type Test = TestConvex<typeof schema>;

async function seedUser(t: Test, email: string) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("users", {
      name: "Submission User",
      email,
      emailVerificationTime: Date.now(),
    }),
  );
}

async function seedSubmission(
  t: Test,
  userId: Id<"users">,
  overrides: {
    threadId?: string;
    status?: "preparing" | "awaiting_review" | "submitting" | "done" | "failed" | "cancelled";
    goal?: string;
    createdAt?: number;
  } = {},
) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("submissions", {
      userId,
      adapterId: "test-adapter",
      portalUrl: "https://example.test",
      threadId: overrides.threadId ?? "thread-1",
      goal: overrides.goal ?? "Submit the form",
      status: overrides.status ?? "awaiting_review",
      files: {
        inputs: [],
        outputs: [],
        uploadCandidate: { key: "candidate-key", name: "candidate.xlsx" },
      },
      createdAt: overrides.createdAt ?? 1,
      updatedAt: overrides.createdAt ?? 1,
    }),
  );
}

function createTest() {
  const calls: Array<{
    name: "startUploadJob" | "cancelSubmissionJob";
    args: Record<string, unknown>;
  }> = [];
  let failStart = false;
  let writeRunIdOnFailure = false;
  const testModules = {
    ...modules,
    "../convex/browserUseJobs.ts": async () => ({
      startUploadJob: internalAction({
        args: {
          submissionId: v.id("submissions"),
          expectedStatus: v.optional(v.string()),
          expectedCandidateKey: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
          calls.push({ name: "startUploadJob", args: { ...args } });
          if (failStart) {
            if (writeRunIdOnFailure) {
              await ctx.runMutation(internal.submissions.updateSubmission, {
                submissionId: args.submissionId,
                browserJobPatch: { intent: "upload", runId: "run-1" },
              });
            }
            throw new Error("boom");
          }
          return { runId: "run-1", profileId: "profile-1" };
        },
      }),
      cancelSubmissionJob: internalAction({
        args: { submissionId: v.id("submissions") },
        handler: async (_ctx, args) => {
          calls.push({ name: "cancelSubmissionJob", args: { ...args } });
          return { ok: true as const };
        },
      }),
    }),
  };
  return {
    t: convexTest(schema, testModules),
    calls,
    setFailStart: (value: boolean) => {
      failStart = value;
    },
    setWriteRunIdOnFailure: (value: boolean) => {
      writeRunIdOnFailure = value;
    },
  };
}

describe("thread submission convex seams", () => {
  test("lists visible submissions newest first and excludes cancelled or other users", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "owner@example.com");
    const otherUserId = await seedUser(t, "other@example.com");
    await seedSubmission(t, userId, { goal: "older", createdAt: 1 });
    await seedSubmission(t, userId, {
      goal: "awaiting",
      status: "awaiting_review",
      createdAt: 2,
    });
    await seedSubmission(t, userId, {
      goal: "cancelled",
      status: "cancelled",
      createdAt: 3,
    });
    await seedSubmission(t, otherUserId, { goal: "other user", createdAt: 4 });

    const page = await t
      .withIdentity({ subject: userId })
      .query(api.submissions.listThreadSubmissions, {
        threadId: "thread-1",
        paginationOpts: { numItems: 10, cursor: null },
      });

    expect(page.page.map((submission) => submission.goal)).toEqual([
      "awaiting",
      "older",
    ]);
  });

  test("thread activity tracks visible files and awaiting review", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "owner@example.com");
    const awaitingId = await seedSubmission(t, userId, {
      status: "awaiting_review",
      createdAt: 1,
    });
    const preparingId = await seedSubmission(t, userId, {
      status: "preparing",
      createdAt: 2,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("submissionThreadActivity", {
        userId,
        threadId: "thread-1",
        visibleCount: 2,
        awaitingCount: 1,
        hasAwaitingReview: true,
        updatedAt: 1,
      });
    });

    await t.mutation(internal.submissions.updateSubmission, {
      submissionId: awaitingId,
      status: "done",
    });
    await t.mutation(internal.submissions.updateSubmission, {
      submissionId: preparingId,
      status: "cancelled",
    });

    const activity = await t
      .withIdentity({ subject: userId })
      .query(api.submissions.getThreadActivity, { threadId: "thread-1" });
    expect(activity).toEqual({
      visibleCount: 1,
      awaitingCount: 0,
      hasAwaitingReview: false,
    });
  });

  test("creating another draft adds to thread activity instead of replacing it", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "owner@example.com");
    const draftArgs = {
      userId,
      adapterId: "test-adapter",
      portalUrl: "https://example.test",
      threadId: "thread-1",
      goal: "Submit the form",
    };
    await t.mutation(internal.submissions.createSubmissionDraft, draftArgs);
    await t.mutation(internal.submissions.createSubmissionDraft, draftArgs);

    const activity = await t
      .withIdentity({ subject: userId })
      .query(api.submissions.getThreadActivity, { threadId: "thread-1" });
    expect(activity).toEqual({
      visibleCount: 2,
      awaitingCount: 0,
      hasAwaitingReview: false,
    });
  });

  test("recovers legacy thread activity from all submissions when the row is missing", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "owner@example.com");
    await seedSubmission(t, userId, {
      status: "awaiting_review",
      createdAt: 1,
    });
    await seedSubmission(t, userId, { status: "done", createdAt: 2 });
    const preparingId = await seedSubmission(t, userId, {
      status: "preparing",
      createdAt: 3,
    });

    await t.mutation(internal.submissions.updateSubmission, {
      submissionId: preparingId,
      status: "cancelled",
    });

    const activity = await t
      .withIdentity({ subject: userId })
      .query(api.submissions.getThreadActivity, { threadId: "thread-1" });
    expect(activity).toEqual({
      visibleCount: 2,
      awaitingCount: 1,
      hasAwaitingReview: true,
    });
  });

  test("cancelForUser rejects completed submissions", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "owner@example.com");
    const submissionId = await seedSubmission(t, userId, { status: "done" });

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.submissions.cancelForUser, { submissionId }),
    ).rejects.toThrow("Cannot cancel");
  });

  test("cancelForUser rejects already cancelled submissions", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "owner@example.com");
    const submissionId = await seedSubmission(t, userId, { status: "cancelled" });

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.submissions.cancelForUser, { submissionId }),
    ).rejects.toThrow("Cannot cancel");
  });

  test("approveForUpload claims the submission before starting upload", async () => {
    const { t, calls } = createTest();
    const userId = await seedUser(t, "owner@example.com");
    const submissionId = await seedSubmission(t, userId);
    const authed = t.withIdentity({ subject: userId });

    await authed.action(api.submissions.approveForUpload, { submissionId });

    expect(calls[0]?.name).toBe("startUploadJob");
    expect(calls[0]?.args).toMatchObject({
      expectedStatus: "submitting",
      expectedCandidateKey: "candidate-key",
    });
    const submission = await t.run((ctx) => ctx.db.get(submissionId));
    expect(submission?.status).toBe("submitting");
    await expect(
      authed.action(api.submissions.approveForUpload, { submissionId }),
    ).rejects.toThrow("Cannot approve: submission is submitting");
  });

  test("approveForUpload restores awaiting review when upload start fails", async () => {
    const { t, setFailStart } = createTest();
    setFailStart(true);
    const userId = await seedUser(t, "owner@example.com");
    const submissionId = await seedSubmission(t, userId);

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.submissions.approveForUpload, { submissionId }),
    ).rejects.toThrow("Approval recorded but upload could not be started: boom");

    const submission = await t.run((ctx) => ctx.db.get(submissionId));
    expect(submission?.status).toBe("awaiting_review");
    expect(submission?.error).toContain("boom");
  });

  test("approveForUpload keeps the claimed status when a browser run is live", async () => {
    const { t, setFailStart, setWriteRunIdOnFailure } = createTest();
    setFailStart(true);
    setWriteRunIdOnFailure(true);
    const userId = await seedUser(t, "owner@example.com");
    const submissionId = await seedSubmission(t, userId);

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.submissions.approveForUpload, { submissionId }),
    ).rejects.toThrow("Approval recorded but upload could not be started: boom");

    const submission = await t.run((ctx) => ctx.db.get(submissionId));
    expect(submission?.status).toBe("submitting");
    expect(submission?.browserJob?.runId).toBe("run-1");
  });

  test("cancelForUser claims cancelled before calling the cancel job", async () => {
    const { t, calls } = createTest();
    const userId = await seedUser(t, "owner@example.com");
    const submissionId = await seedSubmission(t, userId);

    await t
      .withIdentity({ subject: userId })
      .action(api.submissions.cancelForUser, { submissionId });

    const submission = await t.run((ctx) => ctx.db.get(submissionId));
    expect(submission?.status).toBe("cancelled");
    expect(calls[0]?.name).toBe("cancelSubmissionJob");
  });
});
