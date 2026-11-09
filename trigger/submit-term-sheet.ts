import { task, logger } from "@trigger.dev/sdk";
import type { Browser, Page } from "puppeteer-core";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  getAdapter,
  getSubmissionState,
  getPortalCredentials,
  loginWithRetry,
  markConnectionError,
  updateSubmission,
  withLightpanda,
  type PortalSession,
} from "./portal";
import { createR2Client, getR2Config } from "./r2";

type Payload = {
  submissionId: string;
  userId: string;
  portalKey: string;
};

async function r2Get(key: string): Promise<Uint8Array> {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured");
  const response = await createR2Client(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  if (!response.Body) throw new Error(`Empty R2 object: ${key}`);
  return new Uint8Array(await response.Body.transformToByteArray());
}

// Child task (fired on approval): uploads the reviewed filled sheet to the
// portal and verifies the success state.
export const submitTermSheet = task({
  id: "submit-term-sheet",
  machine: { preset: "micro" },
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async (payload: Payload) => {
    try {
      const adapter = getAdapter(payload.portalKey);
      const state = await getSubmissionState(payload.submissionId);
      if (!state.files.filled) throw new Error("No filled sheet to upload");

      logger.info("uploading filled sheet", { key: state.files.filled.key });
      const bytes = await r2Get(state.files.filled.key);
      const filename = state.files.filled.originalName;
      await withLightpanda(async (browser: Browser) => {
        const page: Page = await browser.newPage();
        const credentials = await getPortalCredentials(
          payload.userId,
          payload.portalKey,
        );
        let session: PortalSession | undefined;
        await loginWithRetry(async () => {
          session = await adapter.login(
            page,
            credentials.portalEmail,
            credentials.password,
          );
        });
        if (!session) throw new Error("Portal login did not return a session");

        await adapter.uploadFilled(page, session, {
          className: state.className,
          subject: state.subject,
          term: state.term,
          academicYear: state.academicYear,
        }, { bytes, filename });

        const verified = await adapter.verifySuccess(page);
        if (!verified) throw new Error("Could not verify the upload succeeded");
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Portal upload failed";
      logger.error("submit failed", { message });
      await updateSubmission({
        submissionId: payload.submissionId,
        status: "failed",
        error: message,
        auditEvent: "submit_failed",
        auditDetail: { message },
      });
      await markConnectionError(payload.userId, payload.portalKey, message).catch(
        () => undefined,
      );
      return { status: "failed" as const, error: message };
    }

    await updateSubmission({
      submissionId: payload.submissionId,
      status: "done",
      error: undefined,
      auditEvent: "submitted",
    });
    logger.info("submission complete");
    return { status: "done" as const };
  },
});
