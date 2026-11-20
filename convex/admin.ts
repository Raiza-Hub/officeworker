import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const resetSubmissionData = internalMutation({
  args: {
    confirm: v.literal("RESET_SUBMISSIONS_AND_AUDIT_LOG"),
  },
  handler: async (ctx) => {
    let submissions = 0;
    for await (const row of ctx.db.query("submissions")) {
      await ctx.db.delete(row._id);
      submissions += 1;
    }
    let auditLog = 0;
    for await (const row of ctx.db.query("auditLog")) {
      await ctx.db.delete(row._id);
      auditLog += 1;
    }
    return { submissions, auditLog };
  },
});
