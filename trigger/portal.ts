import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

// ---------------------------------------------------------------------------
// LightPanda lifecycle (spawned per task run, connected over CDP)
// ---------------------------------------------------------------------------

export async function spawnLightpanda(): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn("lightpanda", [
    "serve",
    "--host",
    "127.0.0.1",
    "--port",
    "9222",
    "--log_level",
    "info",
  ]);
  await new Promise<void>((resolve, reject) => {
    child.on("spawn", () => resolve());
    child.on("error", (error) => reject(error));
  });
  // Wait for the CDP server to accept connections.
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) return child;
    } catch {
      // not ready yet
    }
    await sleep(250);
  }
  child.kill();
  throw new Error("LightPanda CDP server did not become ready");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withLightpanda<T>(
  fn: (browser: Browser) => Promise<T>,
): Promise<T> {
  const lightpanda = await spawnLightpanda();
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: "ws://127.0.0.1:9222",
      defaultViewport: { width: 1366, height: 850 },
    });
    return await fn(browser);
  } finally {
    await browser?.disconnect().catch(() => undefined);
    lightpanda.kill();
  }
}

// ---------------------------------------------------------------------------
// Convex callbacks (secret-authenticated)
// ---------------------------------------------------------------------------

async function convexCallback<T>(path: string, body: unknown): Promise<T> {
  const siteUrl = process.env.CONVEX_SITE_URL;
  const secret = process.env.TRIGGER_CALLBACK_SECRET;
  if (!siteUrl || !secret) {
    throw new Error("CONVEX_SITE_URL or TRIGGER_CALLBACK_SECRET is not set");
  }
  const response = await fetch(`${siteUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-callback-secret": secret,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.ok !== true) {
    throw new Error(
      `Convex callback ${path} failed (${response.status}): ${String(data.error ?? "unknown")}`,
    );
  }
  return data as T;
}

export type SubmissionTaskState = {
  _id: string;
  userId: string;
  portalKey: string;
  className: string;
  subject: string;
  term: string;
  academicYear: string;
  status: string;
  files: {
    uploads: Array<{ key: string; name: string; size?: number }>;
    template?: { key: string; originalName: string };
    filled?: { key: string; originalName: string };
  };
  mappings: Array<{
    studentName: string;
    matchedName?: string | null;
    matchConfidence?: number | null;
    ca?: number | null;
    exam?: number | null;
    needsReview: boolean;
    source: string;
  }>;
};

export function getSubmissionState(submissionId: string): Promise<SubmissionTaskState> {
  return convexCallback<{ submission: SubmissionTaskState }>(
    "/task_callbacks/submission-state",
    { submissionId },
  ).then((data) => data.submission);
}

export type PortalCredentials = {
  portalKey: string;
  portalUrl: string;
  portalEmail: string;
  password: string;
};

export function getPortalCredentials(
  userId: string,
  portalKey: string,
): Promise<PortalCredentials> {
  return convexCallback<{ credentials: PortalCredentials }>(
    "/task_callbacks/credentials",
    { userId, portalKey },
  ).then((data) => data.credentials);
}

export type SubmissionUpdate = {
  submissionId: string;
  expectStatus?: string;
  status?: string;
  error?: string;
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

export function updateSubmission(update: SubmissionUpdate): Promise<{ applied: boolean }> {
  return convexCallback<{ applied: boolean }>(
    "/task_callbacks/update-submission",
    update,
  );
}

export function markConnectionError(
  userId: string,
  portalKey: string,
  error: string,
): Promise<void> {
  return convexCallback<Record<string, never>>(
    "/task_callbacks/mark-connection-error",
    { userId, portalKey, error },
  ).then(() => undefined);
}

// ---------------------------------------------------------------------------
// Login retry: 3 attempts, exponential backoff with jitter
// ---------------------------------------------------------------------------

export async function loginWithRetry(
  attempt: () => Promise<void>,
  maxAttempts = 3,
): Promise<void> {
  for (let count = 1; count <= maxAttempts; count++) {
    try {
      await attempt();
      return;
    } catch (error) {
      if (count === maxAttempts) throw error;
      const base = 1000 * 2 ** (count - 1);
      const jitter = Math.floor(Math.random() * base * 0.3);
      await sleep(base + jitter);
    }
  }
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Portal adapter interface + DiPER implementation
// ---------------------------------------------------------------------------

export type ScoreTarget = {
  className: string;
  subject: string;
  term: string;
  academicYear: string;
};

export type DownloadedTemplate = {
  bytes: Uint8Array;
  filename: string;
};

export type PortalSession = {
  cookies: Array<{ name: string; value: string; domain: string; path: string }>;
};

export type PortalAdapter = {
  key: string;
  name: string;
  baseUrl: string;
  scoreRange: { ca: [number, number]; exam: [number, number] };
  restoreSession(page: Page, session: PortalSession): Promise<void>;
  login(page: Page, email: string, password: string): Promise<PortalSession>;
  downloadTemplate(
    page: Page,
    session: PortalSession,
    target: ScoreTarget,
  ): Promise<DownloadedTemplate>;
  uploadFilled(
    page: Page,
    session: PortalSession,
    target: ScoreTarget,
    file: { bytes: Uint8Array; filename: string },
  ): Promise<void>;
  verifySuccess(page: Page): Promise<boolean>;
};

// ⚠️ PHASE 0 TBD: selectors below are placeholders until the discovery script
// has walked the real DiPER portal. Update this map — and only this map —
// once Phase 0 completes. Login is EduTAMS-style (email + password form).
const diperSelectors = {
  login: {
    emailInput: 'input[name="email"], input[type="email"]',
    passwordInput: 'input[name="password"], input[type="password"]',
    submitButton: 'button[type="submit"]',
    dashboardMarker: '[data-page="dashboard"], .dashboard, #dashboard',
    errorMarker: ".error, .alert-danger, [role='alert']",
  },
  templates: {
    navLink: 'a[href*="term-sheet"], a[href*="result-entry"]',
    classSelect: 'select[name="class"], select[name="class_id"]',
    subjectSelect: 'select[name="subject"], select[name="subject_id"]',
    termSelect: 'select[name="term"], select[name="term_id"]',
    yearSelect: 'select[name="year"], select[name="session"]',
    downloadButton: 'a[href$=".xlsx"], a[download]',
  },
  upload: {
    navLink: 'a[href*="upload"], a[href*="term-sheet"]',
    fileInput: 'input[type="file"]',
    submitButton: 'button[type="submit"]',
    successMarker: ".success, .alert-success, [role='status']",
    errorMarker: ".error, .alert-danger, [role='alert']",
  },
};

export const diperAdapter: PortalAdapter = {
  key: "diper",
  name: "DiPER",
  baseUrl: "https://diper.ogunstate.gov.ng",
  scoreRange: { ca: [0, 40], exam: [0, 60] },

  async login(page, email, password) {
    await page.goto(`${this.baseUrl}/login`, { waitUntil: "networkidle2" });
    await page.locator(diperSelectors.login.emailInput).fill(email);
    await page.locator(diperSelectors.login.passwordInput).fill(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => undefined),
      page.locator(diperSelectors.login.submitButton).click(),
    ]);
    const error = await page.$(diperSelectors.login.errorMarker);
    if (error) {
      throw new Error("Portal rejected the credentials");
    }
    const dashboard = await page.$(diperSelectors.login.dashboardMarker);
    if (!dashboard) {
      throw new Error("Login did not reach the dashboard");
    }
    const cookies = await page.cookies();
    return {
      cookies: cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
      })),
    };
  },

  async restoreSession(page, session) {
    if (session.cookies.length > 0) {
      await page.setCookie(...session.cookies);
    }
  },

  async downloadTemplate(page, session, _target) {
    void _target; // Phase 0: selector map drives the real picker flow.
    await this.restoreSession(page, session);
    await page.goto(`${this.baseUrl}/teacher/term-sheets`, { waitUntil: "networkidle2" });
    // ⚠️ PHASE 0 TBD: actual picker flow on the portal.
    const client = await page.target().createCDPSession();
    const downloadPath = `/tmp/term-sheet-${Date.now()}`;
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath,
    });
    await page.locator(diperSelectors.templates.downloadButton).click();
    // Phase 0: capture the actual downloaded file name + bytes via fs watch.
    throw new Error(
      "downloadTemplate is a Phase 0 placeholder — run the discovery script against the live portal",
    );
  },

  async uploadFilled(page, session, _target, file) {
    await this.restoreSession(page, session);
    await page.goto(`${this.baseUrl}/teacher/term-sheets`, { waitUntil: "networkidle2" });
    const fileInput = await page.$(diperSelectors.upload.fileInput);
    if (!fileInput) throw new Error("Portal upload input not found");
    await (
      fileInput as import("puppeteer-core").ElementHandle<HTMLInputElement>
    ).uploadFile(`/tmp/${file.filename}`);
    await page.locator(diperSelectors.upload.submitButton).click();
    const success = await page
      .waitForSelector(diperSelectors.upload.successMarker, { timeout: 15000 })
      .catch(() => null);
    if (!success) {
      const failure = await page.$(diperSelectors.upload.errorMarker);
      throw new Error(
        failure
          ? "Portal reported an upload error"
          : "Upload success marker did not appear",
      );
    }
  },

  async verifySuccess(page) {
    const success = await page.$(diperSelectors.upload.successMarker);
    return success !== null;
  },
};

export function getAdapter(portalKey: string): PortalAdapter {
  if (portalKey === diperAdapter.key) return diperAdapter;
  throw new Error(`No portal adapter registered for "${portalKey}"`);
}
