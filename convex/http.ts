import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import type { Id } from "./_generated/dataModel";

function requireCallbackSecret(request: Request): void {
  const secret = process.env.TRIGGER_CALLBACK_SECRET;
  if (!secret) {
    throw new Error("TRIGGER_CALLBACK_SECRET is not set");
  }
  if (request.headers.get("x-callback-secret") !== secret) {
    throw new Error("Unauthorized callback");
  }
}

function jsonOk(body: Record<string, unknown>): Response {
  return Response.json({ ok: true, ...body });
}

function jsonError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyKorapaySignature(data: unknown, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return safeEqual(toHex(new Uint8Array(digest)), signature.toLowerCase());
}

const korapayWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.KORAPAY_SECRET_KEY;
  const signature = request.headers.get("x-korapay-signature");
  if (!secret || !signature) return jsonError("Invalid webhook signature", 401);

  let payload: {
    event?: string | { type?: string };
    data?: {
      reference?: string;
      payment_reference?: string;
      status?: string;
      amount?: string | number;
      currency?: string;
    };
  };
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid webhook JSON");
  }
  if (!(await verifyKorapaySignature(payload.data, signature, secret))) {
    return jsonError("Invalid webhook signature", 401);
  }
  const eventType = typeof payload.event === "string" ? payload.event : payload.event?.type;
  if (eventType !== "charge.success" || !payload.data?.reference) {
    return Response.json({ ok: true, ignored: true });
  }

  try {
    const verification = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(payload.data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const result = (await verification.json()) as {
      status?: boolean | string;
      data?: {
        reference?: string;
        payment_reference?: string;
        status?: string;
        amount?: string | number;
        amount_paid?: string | number;
        currency?: string;
      };
    };
    const verified = result.data;
    if (!verification.ok || String(result.status) !== "true" || verified?.status !== "success") {
      return jsonError("Korapay has not verified this payment", 400);
    }
    const reference =
      verified.payment_reference ??
      payload.data.payment_reference ??
      verified.reference ??
      payload.data.reference;
    const amount = Number(verified.amount_paid ?? verified.amount);
    await ctx.runMutation(internal.billing.applyTopup, {
      reference,
      amount,
      currency: verified.currency ?? payload.data.currency ?? "",
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not apply top-up", 422);
  }
});

// trigger.dev task → Convex: idempotent submission state transition.
export const taskUpdateSubmission = httpAction(async (ctx, request) => {
    try {
      requireCallbackSecret(request);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
    }

    let body: {
      submissionId: string;
      expectStatus?: string;
      status?: string;
      error?: string;
      runIdKind?: string;
      runId?: string;
      templateKey?: string;
      templateName?: string;
      filledKey?: string;
      filledName?: string;
      auditEvent?: string;
      auditDetail?: unknown;
      mappings?: Array<{
        studentName: string;
        matchedName?: string;
        matchConfidence?: number;
        ca?: number;
        exam?: number;
        needsReview: boolean;
        source: "ai" | "manual" | "edited";
      }>;
    };
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body");
    }

    if (typeof body.submissionId !== "string") {
      return jsonError("submissionId is required");
    }

    try {
      const result = await ctx.runMutation(internal.submissions.updateSubmission, {
        submissionId: body.submissionId as Id<"submissions">,
        expectStatus: body.expectStatus,
        status: body.status as
          | "draft"
          | "preparing"
          | "awaiting_review"
          | "login_failed"
          | "submitting"
          | "done"
          | "failed"
          | "cancelled"
          | undefined,
        error: body.error,
        runIdKind: body.runIdKind as "login" | "submit" | undefined,
        runId: body.runId,
        templateKey: body.templateKey,
        templateName: body.templateName,
        filledKey: body.filledKey,
        filledName: body.filledName,
        auditEvent: body.auditEvent,
        auditDetail: body.auditDetail,
      });
      if (
        body.mappings !== undefined &&
        Array.isArray(body.mappings) &&
        body.mappings.length > 0
      ) {
        await ctx.runMutation(internal.submissions.replaceScoreMappings, {
          submissionId: body.submissionId as Id<"submissions">,
          mappings: body.mappings,
        });
      }
      return jsonOk({ applied: result.applied });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Update failed", 422);
    }
});

// trigger.dev task → Convex: fetch the submission state (uploads, mappings).
export const taskGetSubmissionState = httpAction(async (ctx, request) => {
    try {
      requireCallbackSecret(request);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
    }

    let submissionId: string;
    try {
      const body = (await request.json()) as { submissionId?: string };
      if (typeof body.submissionId !== "string") {
        return jsonError("submissionId is required");
      }
      submissionId = body.submissionId;
    } catch {
      return jsonError("Invalid JSON body");
    }

    const submission = await ctx.runQuery(
      internal.submissions.getSubmissionForTask,
      { submissionId: submissionId as Id<"submissions"> },
    );
    if (submission === null) {
      return jsonError("Submission not found", 404);
    }
    return jsonOk({ submission });
});

// trigger.dev task → Convex: decrypted portal credentials for login.
export const taskGetCredentials = httpAction(async (ctx, request) => {
    try {
      requireCallbackSecret(request);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
    }

    let body: { userId?: string; portalKey?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body");
    }
    if (typeof body.userId !== "string") {
      return jsonError("userId is required");
    }

    try {
      const credentials = await ctx.runAction(
        internal.workspaceActions.getDecryptedCredentials,
        { userId: body.userId as Id<"users">, portalKey: body.portalKey },
      );
      return jsonOk({ credentials });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Failed", 404);
    }
});

// trigger.dev task → Convex: mark the workspace connection as errored.
export const taskMarkConnectionError = httpAction(async (ctx, request) => {
    try {
      requireCallbackSecret(request);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
    }

    let body: { userId?: string; portalKey?: string; error?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body");
    }
    if (typeof body.userId !== "string" || typeof body.error !== "string") {
      return jsonError("userId and error are required");
    }

    await ctx.runMutation(internal.workspace.markConnectionError, {
      userId: body.userId as Id<"users">,
      portalKey: body.portalKey ?? "diper",
      error: body.error,
    });
    return jsonOk({});
});

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/korapay-webhook", method: "POST", handler: korapayWebhook });
http.route({
  path: "/task_callbacks/update-submission",
  method: "POST",
  handler: taskUpdateSubmission,
});
http.route({
  path: "/task_callbacks/submission-state",
  method: "POST",
  handler: taskGetSubmissionState,
});
http.route({
  path: "/task_callbacks/credentials",
  method: "POST",
  handler: taskGetCredentials,
});
http.route({
  path: "/task_callbacks/mark-connection-error",
  method: "POST",
  handler: taskMarkConnectionError,
});

export default http;
