import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const submissionStatus = v.union(
  v.literal("preparing"),
  v.literal("awaiting_review"),
  v.literal("login_failed"),
  v.literal("submitting"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const browserJobValidator = v.object({
  provider: v.literal("browser_use"),
  intent: v.string(),
  phase: v.optional(v.string()),
  status: v.optional(v.string()),
  runId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  workspaceId: v.optional(v.string()),
  profileId: v.optional(v.string()),
  lastEventCursor: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
  keepAliveUntil: v.optional(v.number()),
  attempts: v.optional(v.number()),
  lastError: v.optional(v.string()),
  resultSummary: v.optional(v.string()),
  syncDisabled: v.optional(v.boolean()),
  reservationId: v.optional(v.id("usageReservations")),
  providerCostUsd: v.optional(v.number()),
  billingSettled: v.optional(v.boolean()),
});

const artifactFileValidator = v.object({
  key: v.string(),
  name: v.string(),
  size: v.optional(v.number()),
  sourcePath: v.optional(v.string()),
});

const billingOperation = v.union(
  v.literal("chat"),
  v.literal("title"),
  v.literal("pdf"),
  v.literal("browser_use"),
  v.literal("custom_tool"),
);

const reservationStatus = v.union(
  v.literal("active"),
  v.literal("settled"),
  v.literal("released"),
  v.literal("expired"),
  v.literal("cancelled"),
);

export default defineSchema({
  ...authTables,
  wallets: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("basic"), v.literal("pro")),
    balance: v.number(),
    reserved: v.number(),
    balanceKobo: v.optional(v.number()),
    reservedKobo: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  walletTransactions: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("topup"),
      v.literal("upload"),
      v.literal("usage"),
      v.literal("adjustment"),
    ),
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
    plan: v.optional(v.union(v.literal("basic"), v.literal("pro"))),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("failed")),
    createdAt: v.number(),
    paymentMethod: v.optional(v.string()),
    gatewayStatus: v.optional(v.string()),
    gatewayReference: v.optional(v.string()),
    currency: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_reference", ["reference"])
    .index("by_user_created", ["userId", "createdAt"]),

  paymentReports: defineTable({
    userId: v.id("users"),
    intentId: v.id("topupIntents"),
    reference: v.string(),
    amount: v.number(),
    plan: v.union(v.literal("basic"), v.literal("pro")),
    paymentStatus: v.union(v.literal("paid"), v.literal("failed")),
    status: v.union(v.literal("open"), v.literal("resolved")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_intent", ["intentId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_status_created", ["status", "createdAt"]),

  fxRates: defineTable({
    source: v.union(
      v.literal("seed"),
      v.literal("frankfurter"),
      v.literal("exchangerate_api"),
    ),
    usdToNgn: v.number(),
    sourceDate: v.optional(v.string()),
    sourceUpdatedAt: v.optional(v.number()),
    fetchedAt: v.number(),
    active: v.boolean(),
    rawPayload: v.optional(v.any()),
  })
    .index("by_active", ["active"])
    .index("by_fetched", ["fetchedAt"]),

  billingConfigVersions: defineTable({
    key: v.literal("default"),
    version: v.number(),
    active: v.boolean(),
    markupPct: v.number(),
    holdSafetyFactor: v.number(),
    browserUseMaxCostUsd: v.number(),
    chatTurnCapKobo: v.number(),
    titleCapKobo: v.number(),
    customToolCapKobo: v.number(),
    pdfCapKobo: v.number(),
    activeFxRateId: v.optional(v.id("fxRates")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key_active", ["key", "active"])
    .index("by_version", ["version"]),

  creditLedger: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("topup"),
      v.literal("reservation"),
      v.literal("release"),
      v.literal("charge"),
      v.literal("adjustment"),
    ),
    amountKobo: v.number(),
    balanceAfterKobo: v.number(),
    reservedAfterKobo: v.number(),
    reference: v.string(),
    description: v.string(),
    reservationId: v.optional(v.id("usageReservations")),
    usageEventId: v.optional(v.id("usageEvents")),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_reference", ["reference"])
    .index("by_reservation", ["reservationId"])
    .index("by_usage_event", ["usageEventId"]),

  usageReservations: defineTable({
    userId: v.id("users"),
    key: v.string(),
    operation: billingOperation,
    scopeKey: v.optional(v.string()),
    amountKobo: v.number(),
    usdToNgn: v.number(),
    markupPct: v.number(),
    fxRateId: v.id("fxRates"),
    status: reservationStatus,
    metadata: v.optional(v.any()),
    providerRef: v.optional(v.string()),
    usageEventId: v.optional(v.id("usageEvents")),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_user_status", ["userId", "status"])
    .index("by_scope_status", ["scopeKey", "status"])
    .index("by_expires", ["status", "expiresAt"]),

  usageEvents: defineTable({
    userId: v.id("users"),
    reservationId: v.id("usageReservations"),
    operation: billingOperation,
    providerCostUsd: v.number(),
    usdToNgn: v.number(),
    markupPct: v.number(),
    actualKobo: v.number(),
    chargeKobo: v.number(),
    underRecoveryKobo: v.number(),
    providerRef: v.optional(v.string()),
    usage: v.optional(v.any()),
    idempotencyKey: v.string(),
    fxRateId: v.id("fxRates"),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_reservation", ["reservationId"])
    .index("by_idempotency", ["idempotencyKey"]),

  settlementOutbox: defineTable({
    reservationId: v.id("usageReservations"),
    userId: v.id("users"),
    providerCostUsd: v.number(),
    providerRef: v.optional(v.string()),
    usage: v.optional(v.any()),
    idempotencyKey: v.string(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_next", ["status", "nextAttemptAt"])
    .index("by_reservation", ["reservationId"])
    .index("by_idempotency", ["idempotencyKey"]),

  workCancellationRequests: defineTable({
    userId: v.id("users"),
    scopeKey: v.optional(v.string()),
    provider: v.optional(v.string()),
    providerRef: v.optional(v.string()),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_scope", ["scopeKey", "status"]),

  documents: defineTable({
    name: v.string(),
    type: v.string(),
    size: v.number(),
    storageKey: v.string(),
    status: v.union(v.literal("Uploading"), v.literal("Success")),
    ownerId: v.id("users"),
    kind: v.optional(v.string()),
    sizeBucket: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["ownerId", "kind", "sizeBucket", "status"],
    }),

  // Teacher portal connection (generic, any portal URL/account).
  // `ciphertext` = encrypted portal password (AES-256-GCM), key in ENCRYPTION_KEY.
  // Browser automation login reuse is handled via Browser Use Cloud Profile
  // (`browserUseProfileId`) and per-run secret bindings (best-effort login, no live HITL);
  // portal password is not transmitted to the agent.
  workspaceConnections: defineTable({
    userId: v.id("users"),
    adapterId: v.string(),
    portalUrl: v.string(),
    portalEmail: v.string(),
    ciphertext: v.string(),
    status: v.union(v.literal("connected"), v.literal("error")),
    browserUseProfileId: v.optional(v.string()),
    browserUseProfileStatus: v.optional(
      v.union(v.literal("unknown"), v.literal("ready"), v.literal("needs_login")),
    ),
    lastErrorAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  submissions: defineTable({
    userId: v.id("users"),
    adapterId: v.string(),
    portalUrl: v.string(),
    threadId: v.optional(v.string()),
    goal: v.string(),
    status: submissionStatus,
    edits: v.optional(
      v.array(
        v.object({
          cell: v.string(),
          value: v.union(v.string(), v.number(), v.null()),
        }),
      ),
    ),
    browserJob: v.optional(browserJobValidator),
    error: v.optional(v.string()),
    files: v.object({
      inputs: v.array(artifactFileValidator),
      outputs: v.array(artifactFileValidator),
      uploadCandidate: v.optional(artifactFileValidator),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_thread", ["threadId"]),

  auditLog: defineTable({
    submissionId: v.id("submissions"),
    event: v.string(),
    detail: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_submission", ["submissionId"])
    .index("by_time", ["at"]),

  threadActivity: defineTable({
    userId: v.id("users"),
    threadId: v.string(),
    title: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"))),
    lastActivityAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user_activity", ["userId", "lastActivityAt"])
    .index("by_user_status_activity", ["userId", "status", "lastActivityAt"])
    .index("by_status_activity", ["status", "lastActivityAt"]),

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
