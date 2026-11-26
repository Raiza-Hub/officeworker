"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { BrowserUse } from "browser-use-sdk/v4";

export const RUN_KEEP_ALIVE_SECONDS = 120;
export const DOWNLOAD_URL_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes to tolerate slow networks and 60s URL refresh
export const POLL_INTERVAL_MS = 4000;

function getApiKey(): string {
  const key = process.env.BROWSER_USE_API_KEY;
  if (!key) throw new Error("BROWSER_USE_API_KEY is not set");
  return key;
}

function getBrowserUseModel(): string | undefined {
  const v = process.env.BROWSER_USE_MODEL?.trim();
  return v ? v : undefined;
}

function getClient(): BrowserUse {
  return new BrowserUse({ apiKey: getApiKey() });
}

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function asStringId(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s ? s : undefined;
}

export type BrowserUseRun = {
  id?: string;
  runId?: string;
  status?: string;
  result?: string | null;
  output?: unknown;
  error?: string | null;
  sessionId?: string;
  session_id?: string;
  workspaceId?: string | null;
  workspace_id?: string | null;
  [k: string]: any;
};

function normalizeRun(raw: any): BrowserUseRun & { id?: string; sessionId?: string; workspaceId?: string } {
  if (!raw || typeof raw !== "object") return raw as any;
  const id = asStringId(raw.id ?? raw.runId ?? raw.run_id);
  const sessionId = asStringId(raw.sessionId ?? raw.session_id);
  const workspaceId = asStringId(raw.workspaceId ?? raw.workspace_id);
  return { ...raw, id, sessionId, workspaceId };
}

function runIdOf(run: BrowserUseRun): string {
  const id = asStringId(run.id ?? run.runId);
  if (!id) throw new Error("Browser Use run response missing id");
  return id;
}
function sessionIdOf(run: BrowserUseRun): string | undefined {
  return asStringId(run.sessionId ?? run.session_id);
}
function workspaceIdOf(run: BrowserUseRun): string | undefined {
  return asStringId(run.workspaceId ?? run.workspace_id);
}

export async function createProfile(name?: string) {
  const client = getClient();
  return await client.profiles.create(name ? { name } : undefined);
}

export async function createWorkspace(name?: string) {
  const client = getClient();
  return await client.workspaces.create(name ? { name } : undefined);
}

export type SecretBinding = {
  alias: string;
  source:
    | { type: "inline"; value: string }
    | { type: "onepassword"; integrationId: string; vaultId: string; itemId: string; fieldId: string };
  allowedDomains: string[];
};

export type CreateRunInput = {
  task: string;
  sessionId?: string;
  workspaceId?: string;
  profileId?: string | null;
  keepAlive?: number | null;
  browserSettings?: Record<string, any>;
  model?: string;
  secretBindings?: SecretBinding[] | null;
  [k: string]: any;
};

export async function createRun(input: CreateRunInput): Promise<{
  id: string;
  raw: BrowserUseRun;
  sessionId?: string;
  workspaceId?: string;
}> {
  const client = getClient();
  const browserSettings: Record<string, any> = {
    // Hard requirement: never use BU proxy for portal automation.
    proxyCountryCode: null,
    ...(input.browserSettings ?? {}),
  };
  if (input.profileId) browserSettings.profileId = input.profileId;

  const model = input.model ?? getBrowserUseModel();
  const body: Record<string, any> = {
    task: input.task,
    browserSettings,
  };
  // BU Cloud run agent model (optional). Distinct from our assistant AI_MODEL.
  // When unset, Browser Use selects its default model for the project/plan.
  if (model) body.model = model;
  if (input.sessionId) body.sessionId = input.sessionId;
  if (input.workspaceId) body.workspaceId = input.workspaceId;
  if (input.keepAlive !== undefined && input.keepAlive !== null) body.keepAlive = input.keepAlive;
  if (input.secretBindings && input.secretBindings.length > 0) body.secretBindings = input.secretBindings;

  // Pass through additional allowed fields if provided (e.g. outputSchema, attachedFileIds).
  for (const [k, v] of Object.entries(input)) {
    if (
      [
        "task",
        "sessionId",
        "workspaceId",
        "profileId",
        "keepAlive",
        "browserSettings",
        "model",
        "secretBindings",
      ].includes(k)
    )
      continue;
    if (v === undefined) continue;
    body[k] = v;
  }

  const rawResp = await client.runs.create(body as any);
  const raw = normalizeRun(rawResp);
  return { id: runIdOf(raw), raw, sessionId: sessionIdOf(raw), workspaceId: workspaceIdOf(raw) };
}

export async function getRunStatus(runId: string) {
  const client = getClient();
  return await client.runs.status(runId);
}

export async function getRun(runId: string) {
  const client = getClient();
  return normalizeRun(await client.runs.get(runId));
}

export async function cancelRun(runId: string) {
  const client = getClient();
  return await client.runs.cancel(runId);
}

export async function getRunEvents(runId: string, after?: number | null) {
  const client = getClient();
  return await client.runs.events(runId, { after: after ?? undefined, limit: 200 });
}

/**
 * Drain run events across pages from a cursor. v4 `nextAfter/after` are integers.
 * Returns merged events and the final nextAfter cursor to persist.
 */
export async function drainRunEvents(
  runId: string,
  after?: number | null,
): Promise<{ events: any[]; nextAfter: number | null }> {
  let cursor: number | null | undefined = after ?? null;
  const out: any[] = [];
  let lastNext: number | null = typeof after === "number" ? after : null;
  for (let i = 0; i < 20; i++) {
    const page = await getRunEvents(runId, cursor ?? undefined);
    const events = Array.isArray((page as any)?.events) ? (page as any).events : Array.isArray(page) ? page : [];
    out.push(...events);
    const nextAfterRaw = (page as any)?.nextAfter ?? (page as any)?.next_after ?? null;
    const hasMore = Boolean((page as any)?.hasMore ?? (page as any)?.has_more);
    const nextAfter = typeof nextAfterRaw === "number" ? nextAfterRaw : nextAfterRaw != null ? Number(nextAfterRaw) : null;
    if (typeof nextAfter === "number" && Number.isFinite(nextAfter)) lastNext = nextAfter;
    if (!hasMore) break;
    // advance cursor; if API doesn't advance, stop to avoid infinite loop
    if (nextAfter == null || nextAfter === cursor) break;
    cursor = nextAfter;
  }
  return { events: out, nextAfter: lastNext };
}

export async function queueSessionMessage(sessionId: string, text: string, interrupt = false) {
  const client = getClient();
  // v4 SDK: sessions.sendMessage(sessionId, { text, interrupt })
  return await client.sessions.sendMessage(sessionId, { text, interrupt } as any);
}

export type WorkspaceFileEntry = {
  path?: string;
  name?: string;
  size?: number;
  lastModified?: string;
  url?: string | null;
  [k: string]: any;
};

export type WorkspaceFileList = {
  files: WorkspaceFileEntry[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

function normalizeFileList(listing: any): WorkspaceFileList {
  const files: WorkspaceFileEntry[] = Array.isArray(listing?.files)
    ? listing.files
    : Array.isArray(listing)
      ? listing
      : [];
  return {
    files,
    nextCursor: (listing?.nextCursor ?? listing?.next_cursor ?? null) as string | null,
    hasMore: Boolean(listing?.hasMore ?? listing?.has_more),
  };
}

export async function listWorkspaceFiles(workspaceId: string, includeUrls = true): Promise<WorkspaceFileList> {
  const client = getClient();
  return normalizeFileList(await client.workspaces.files(workspaceId, { includeUrls }));
}

export async function listAllWorkspaceFiles(workspaceId: string, includeUrls = true): Promise<WorkspaceFileEntry[]> {
  const client = getClient();
  const all: WorkspaceFileEntry[] = [];
  let cursor: string | null | undefined = undefined;
  for (let i = 0; i < 50; i++) {
    const page = normalizeFileList(
      await client.workspaces.files(workspaceId, { includeUrls, cursor: cursor ?? undefined, limit: 100 }),
    );
    all.push(...page.files);
    if (!page.hasMore || !page.nextCursor) break;
    if (page.nextCursor === cursor) break;
    cursor = page.nextCursor;
  }
  return all;
}

export async function createWorkspaceUploadUrls(args: {
  workspaceId: string;
  files: Array<{ name: string; contentType: string; size: number }>;
  allowOverrides?: boolean;
}) {
  const client = getClient();
  return await client.workspaces.uploadFiles(args.workspaceId, {
    files: args.files.map((f) => ({ name: f.name, contentType: f.contentType, size: f.size })) as any,
    allowOverrides: args.allowOverrides ?? true,
  } as any);
}

function filePathOf(f: WorkspaceFileEntry): string {
  return String((f as any).path ?? (f as any).name ?? (f as any).filename ?? "");
}
function fileUrlOf(f: WorkspaceFileEntry): string | undefined {
  const u = (f as any).url ?? (f as any).downloadUrl;
  return u ? String(u) : undefined;
}

async function fetchBytes(url: string, timeoutMs = 90_000): Promise<Uint8Array> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err: any = new Error(`Download failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

/**
 * Download files from a BU workspace with tolerance for slow networks and
 * v4 workspace presigned URL expiry (~60s): re-lists (all pages) to refresh
 * URLs and retries for up to ~5 minutes. No browser-downloads fallback.
 */
export async function downloadWorkspaceFilesTolerant(args: {
  workspaceId: string;
  deadlineMs?: number;
  pathHints?: string[]; // optional substrings to prefer/filter
}): Promise<Array<{ path: string; bytes: Uint8Array; size: number }>> {
  const deadlineAt = Date.now() + (args.deadlineMs ?? DOWNLOAD_URL_TOLERANCE_MS);
  let lastError: unknown = null;

  while (Date.now() < deadlineAt) {
    try {
      // Refresh by relisting all pages with fresh URLs each attempt.
      const files = await listAllWorkspaceFiles(args.workspaceId, true);
      let candidates = files.filter((f) => filePathOf(f));
      if (args.pathHints && args.pathHints.length > 0) {
        const hinted = candidates.filter((f) =>
          args.pathHints!.some((h) => filePathOf(f).toLowerCase().includes(h.toLowerCase())),
        );
        if (hinted.length > 0) candidates = hinted;
      }
      // Prefer spreadsheets when hints/candidates include mixed types.
      const spreadsheets = candidates.filter((f) => /\.(xlsx|xls|csv)$/i.test(filePathOf(f)));
      if (spreadsheets.length > 0) candidates = spreadsheets;

      if (candidates.length === 0) {
        lastError = new Error("No files found in Browser Use workspace yet");
      } else {
        const fetched = await Promise.all(
          candidates.map(async (f) => {
            const url = fileUrlOf(f);
            if (!url) {
              return {
                error: new Error(
                  `No download URL for workspace file ${filePathOf(f)}`,
                ) as unknown,
              };
            }
            try {
              return { bytes: await fetchBytes(url, 90_000) };
            } catch (e: any) {
              return { error: e as unknown };
            }
          }),
        );
        const results: Array<{ path: string; bytes: Uint8Array; size: number }> = [];
        let allOk = true;
        for (const [index, f] of candidates.entries()) {
          const outcome = fetched[index]!;
          if ("error" in outcome) {
            allOk = false;
            lastError = outcome.error;
            // URL may have expired (~60s) or network failed; refresh by relist next loop.
          } else {
            const path = filePathOf(f);
            results.push({ path, bytes: outcome.bytes, size: outcome.bytes.byteLength });
          }
        }
        if (allOk && results.length > 0) return results;
      }
    } catch (e) {
      lastError = e;
    }
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(4000, Math.max(1500, remaining > 30000 ? 4000 : 2000)));
  }
  const secs = Math.round(DOWNLOAD_URL_TOLERANCE_MS / 1000);
  throw lastError instanceof Error
    ? new Error(`Failed to download Browser Use workspace files within ${secs}s: ${lastError.message}`)
    : new Error(`Failed to download Browser Use workspace files within ${secs}s`);
}

export function isTerminalRunStatus(status: string | undefined | null): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "completed" || s === "failed" || s === "cancelled" || s === "canceled" || s === "stopped";
}

export function isSuccessRunStatus(status: string | undefined | null): boolean {
  return String(status ?? "").toLowerCase() === "completed";
}

export function getBrowserUseConfiguredModel(): string | undefined {
  return getBrowserUseModel();
}
