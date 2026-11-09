import { task, logger, tasks } from "@trigger.dev/sdk";
import type { Browser, Page } from "puppeteer-core";
import {
  getAdapter,
  getPortalCredentials,
  loginWithRetry,
  markConnectionError,
  updateSubmission,
  withLightpanda,
  type PortalSession,
} from "./portal";

type Payload = {
  submissionId: string;
  userId: string;
  portalKey: string;
  className: string;
  subject: string;
  term: string;
  academicYear: string;
};

// Parent task: logs into the teacher portal (3 attempts, exponential backoff +
// jitter) and fans out prepare work as a fire-and-forget child task with the
// authenticated session cookies.
export const portalLogin = task({
  id: "portal-login",
  machine: { preset: "micro" },
  maxDuration: 600,
  retry: { maxAttempts: 1 },
  run: async (payload: Payload) => {
    const adapter = getAdapter(payload.portalKey);

    logger.info("logging into portal", { portalKey: payload.portalKey });

    let session: PortalSession;
    try {
      session = await withLightpanda(async (browser: Browser) => {
        const page: Page = await browser.newPage();
        const credentials = await getPortalCredentials(
          payload.userId,
          payload.portalKey,
        );
        let result: PortalSession | undefined;
        await loginWithRetry(async () => {
          result = await adapter.login(
            page,
            credentials.portalEmail,
            credentials.password,
          );
        });
        if (!result) throw new Error("Portal login did not return a session");
        return result;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Portal login failed";
      logger.error("portal login failed after retries", { message });
      await updateSubmission({
        submissionId: payload.submissionId,
        status: "login_failed",
        error: message,
        auditEvent: "login_failed",
        auditDetail: { attempts: 3 },
      });
      await markConnectionError(payload.userId, payload.portalKey, message).catch(
        () => undefined,
      );
      return { status: "login_failed" as const, error: message };
    }

    await updateSubmission({
      submissionId: payload.submissionId,
      status: "preparing",
      auditEvent: "login_succeeded",
    });

    // Fire-and-forget: the child reports progress through Convex callbacks.
    const handle = await tasks.trigger("prepare-term-sheet", {
      submissionId: payload.submissionId,
      userId: payload.userId,
      portalKey: payload.portalKey,
      className: payload.className,
      subject: payload.subject,
      term: payload.term,
      academicYear: payload.academicYear,
      cookies: session.cookies,
      reuseTemplate: false,
    });
    logger.info("prepare child triggered", { runId: handle.id });

    return { status: "logged_in" as const, childRunId: handle.id };
  },
});
