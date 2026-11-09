import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  wallets: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("basic"), v.literal("pro")),
    balance: v.number(),
    reserved: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  walletTransactions: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("topup"), v.literal("upload")),
    amount: v.number(),
    reference: v.string(),
    description: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_reference", ["reference"]),

  topupIntents: defineTable({
    userId: v.id("users"),
    reference: v.string(),
    amount: v.number(),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("failed")),
    createdAt: v.number(),
  })
    .index("by_reference", ["reference"])
    .index("by_user_created", ["userId", "createdAt"]),

  documents: defineTable({
    name: v.string(),
    type: v.string(),
    size: v.number(),
    storageKey: v.string(),
    status: v.union(v.literal("Uploading"), v.literal("Success")),
    ownerId: v.id("users"),
  })
    .index("by_owner", ["ownerId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["ownerId"],
    }),

  // Portal registry — one entry per supported teacher portal (DiPER first).
  portals: defineTable({
    key: v.string(),
    name: v.string(),
    baseUrl: v.string(),
    adapterId: v.string(),
  }).index("by_key", ["key"]),

  // Teacher portal credentials. `ciphertext` = base64(iv || encrypted || authTag)
  // AES-256-GCM, key held in ENCRYPTION_KEY env var — never in the DB.
  workspaceConnections: defineTable({
    userId: v.id("users"),
    portalKey: v.string(),
    portalUrl: v.string(),
    portalEmail: v.string(),
    ciphertext: v.string(),
    status: v.union(v.literal("connected"), v.literal("error")),
    lastErrorAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_portal", ["userId", "portalKey"]),

  // A term-sheet submission job. `files.template.originalName` and
  // `files.filled.originalName` preserve the portal's own filename.
  submissions: defineTable({
    userId: v.id("users"),
    portalKey: v.string(),
    threadId: v.optional(v.string()),
    className: v.string(),
    subject: v.string(),
    term: v.string(),
    academicYear: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("preparing"),
      v.literal("awaiting_review"),
      v.literal("login_failed"),
      v.literal("submitting"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    chargeAmount: v.optional(v.number()),
    chargeStatus: v.optional(
      v.union(v.literal("reserved"), v.literal("charged"), v.literal("released")),
    ),
    runIds: v.object({
      login: v.optional(v.string()),
      prepare: v.optional(v.array(v.string())),
      submit: v.optional(v.string()),
    }),
    error: v.optional(v.string()),
    files: v.object({
      uploads: v.array(
        v.object({
          key: v.string(),
          name: v.string(),
          size: v.optional(v.number()),
        }),
      ),
      template: v.optional(
        v.object({ key: v.string(), originalName: v.string() }),
      ),
      filled: v.optional(
        v.object({ key: v.string(), originalName: v.string() }),
      ),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_thread", ["threadId"]),

  // Extracted/matched scores. Only raw CA and EXAM are stored — totals are
  // computed in memory at render/fill time, never persisted.
  scoreMappings: defineTable({
    submissionId: v.id("submissions"),
    studentName: v.string(),
    matchedName: v.optional(v.string()),
    matchConfidence: v.optional(v.number()),
    ca: v.optional(v.number()),
    exam: v.optional(v.number()),
    needsReview: v.boolean(),
    source: v.union(v.literal("ai"), v.literal("manual"), v.literal("edited")),
  }).index("by_submission", ["submissionId"]),

  auditLog: defineTable({
    submissionId: v.id("submissions"),
    event: v.string(),
    detail: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_submission", ["submissionId"])
    .index("by_time", ["at"]),

  // One row per user turn; powers the /activity chat-history list ordered by
  // recent activity (documented @convex-dev/agent pattern).
  threadActivity: defineTable({
    userId: v.id("users"),
    threadId: v.string(),
    title: v.optional(v.string()),
    lastActivityAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user_activity", ["userId", "lastActivityAt"]),

  // Files attached to a chat message (R2 key only; bytes live in R2). Joined
  // onto UIMessages in listThreadMessages — the agent component's metadata
  // validator has no arbitrary fields, so this table is the source of truth.
  messageAttachments: defineTable({
    messageId: v.string(),
    threadId: v.string(),
    key: v.string(),
    name: v.string(),
    mediaType: v.string(),
    size: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_thread", ["threadId"]),

  assistantTurnTimings: defineTable({
    userId: v.id("users"),
    threadId: v.string(),
    promptMessageId: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
  })
    .index("by_thread", ["threadId"])
    .index("by_prompt", ["promptMessageId"])
    .index("by_user_thread", ["userId", "threadId"]),
});
