"use node";

import { tasks } from "@trigger.dev/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

export const triggerPortalLogin = internalAction({
  args: {
    submissionId: v.string(),
    userId: v.id("users"),
    portalKey: v.string(),
    className: v.string(),
    subject: v.string(),
    term: v.string(),
    academicYear: v.string(),
  },
  handler: async (ctx, args) => {
    const handle = await tasks.trigger("portal-login", {
      submissionId: args.submissionId,
      userId: args.userId,
      portalKey: args.portalKey,
      className: args.className,
      subject: args.subject,
      term: args.term,
      academicYear: args.academicYear,
    });
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId as Id<"submissions">,
      runIdKind: "login",
      runId: handle.id,
    });
    return { runId: handle.id };
  },
});

export const triggerSubmitTermSheet = internalAction({
  args: {
    submissionId: v.string(),
    userId: v.id("users"),
    portalKey: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId as Id<"submissions">,
      status: "submitting",
      auditEvent: "submit_started",
    });
    const handle = await tasks.trigger("submit-term-sheet", {
      submissionId: args.submissionId,
      userId: args.userId,
      portalKey: args.portalKey,
    });
    await ctx.runMutation(internal.submissions.updateSubmission, {
      submissionId: args.submissionId as Id<"submissions">,
      runIdKind: "submit",
      runId: handle.id,
    });
    return { runId: handle.id };
  },
});

// Re-fill without portal access (score edits / name fixes after review).
export const triggerPrepareRefill = internalAction({
  args: {
    submissionId: v.string(),
    userId: v.id("users"),
    portalKey: v.string(),
  },
  handler: async (ctx, args) => {
    const handle = await tasks.trigger("prepare-term-sheet", {
      submissionId: args.submissionId,
      userId: args.userId,
      portalKey: args.portalKey,
      reuseTemplate: true,
    });
    return { runId: handle.id };
  },
});
