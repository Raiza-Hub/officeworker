import { describe, expect, test } from "bun:test";
import type { PdfDocumentObject, PdfEngine } from "@embedpdf/models";
import { createPdfThumbnailCache } from "../lib/pdf-thumbnail-utils";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function createHarness(maxUrls = 2) {
  const renders: string[] = [];
  const revoked: string[] = [];
  let objectUrlCount = 0;
  const renderGates = new Map<string, ReturnType<typeof deferred<Blob>>>();
  const engine = {
    renderThumbnail: () => ({
      toPromise: async () => {
        const gate = deferred<Blob>();
        const url = [...renderGates.keys()].length;
        renderGates.set(`gate-${url}`, gate);
        renders.push(`gate-${url}`);
        return await gate.promise;
      },
    }),
  } as unknown as PdfEngine;
  const document = {
    pages: [{ size: { width: 100, height: 100 } }],
  } as unknown as PdfDocumentObject;
  const cache = createPdfThumbnailCache({
    loadEngine: async () => engine,
    loadDocument: async () => document,
    createObjectURL: () => `url-${++objectUrlCount}`,
    revokeObjectURL: (url) => revoked.push(url),
    maxUrls,
  });
  return { cache, renderGates, renders, revoked };
}

describe("pdf thumbnail cache", () => {
  test("pending keys survive eviction and late completion cannot duplicate cached urls", async () => {
    const { cache, renderGates, renders, revoked } = createHarness(1);
    const slow = cache.renderThumbnailUrl({ url: "a", pageIndex: 0, width: 10, dpr: 1 });
    await flush();
    const gateA = renderGates.get("gate-0")!;
    const fast = cache.renderThumbnailUrl({ url: "b", pageIndex: 0, width: 10, dpr: 1 });
    await flush();
    const gateB = renderGates.get("gate-1")!;
    gateB.resolve(new Blob());
    expect(await fast).toBe("url-1");
    gateA.resolve(new Blob());
    expect(await slow).toBe("url-2");
    expect(revoked.includes("url-1")).toBe(true);
    await cache.renderThumbnailUrl({ url: "a", pageIndex: 0, width: 10, dpr: 1 });
    expect(renders).toHaveLength(2);
  });

  test("clear invalidates pending renders so stale urls are not cached", async () => {
    const { cache, renderGates, renders, revoked } = createHarness(2);
    const stale = cache.renderThumbnailUrl({ url: "stale", pageIndex: 0, width: 10, dpr: 1 });
    await flush();
    const gate = renderGates.get("gate-0")!;
    cache.clear();
    gate.resolve(new Blob());
    expect(await stale).toBeNull();
    expect(revoked.includes("url-1")).toBe(true);
    const fresh = cache.renderThumbnailUrl({ url: "stale", pageIndex: 0, width: 10, dpr: 1 });
    await flush();
    renderGates.get("gate-1")!.resolve(new Blob());
    expect(await fresh).toBe("url-2");
    expect(renders).toHaveLength(2);
  });
});
