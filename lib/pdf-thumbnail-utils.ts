import type { PdfDocumentObject, PdfEngine } from "@embedpdf/models";

const PDFIUM_VERSION = "2.15.0";
const PDFIUM_WASM_URL = `https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@${PDFIUM_VERSION}/dist/pdfium.wasm`;

let sharedEnginePromise: Promise<PdfEngine> | null = null;
const pdfDocumentCache = new Map<string, Promise<PdfDocumentObject>>();

type RenderThumbnailArgs = {
  dpr?: number;
  pageIndex: number;
  url: string;
  width: number;
};

type PdfThumbnailCacheDeps = {
  createObjectURL: (blob: Blob) => string;
  loadDocument: (url: string) => Promise<PdfDocumentObject>;
  loadEngine: () => Promise<PdfEngine>;
  maxUrls?: number;
  revokeObjectURL: (url: string) => void;
};

export function createPdfThumbnailCache({
  createObjectURL,
  loadDocument,
  loadEngine,
  maxUrls = 128,
  revokeObjectURL,
}: PdfThumbnailCacheDeps) {
  const cache = new Map<string, string | null>();
  const pending = new Map<string, Promise<string | null>>();
  const pendingGenerations = new Map<string, number>();
  const settledOrder = new Set<string>();
  const generations = new Map<string, number>();

  const generationFor = (key: string) => generations.get(key) ?? 0;

  const touch = (key: string) => {
    settledOrder.delete(key);
    settledOrder.add(key);
  };

  const evictOldest = () => {
    const oldestKey = settledOrder.values().next().value;
    if (oldestKey === undefined) return;
    const oldestUrl = cache.get(oldestKey);
    if (oldestUrl) revokeObjectURL(oldestUrl);
    cache.delete(oldestKey);
    settledOrder.delete(oldestKey);
  };

  const evictForNewEntry = () => {
    while (
      cache.size + pending.size >= maxUrls &&
      settledOrder.size > 0
    ) {
      evictOldest();
    }
  };

  const renderThumbnailUrl = ({
    dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    pageIndex,
    url,
    width,
  }: RenderThumbnailArgs) => {
    const cacheKey = `${url}#${pageIndex}@${width}x${dpr}`;
    if (cache.has(cacheKey)) {
      touch(cacheKey);
      return Promise.resolve(cache.get(cacheKey) ?? null);
    }
    const existingPromise = pending.get(cacheKey);
    if (existingPromise) return existingPromise;

    const generation = generationFor(cacheKey) + 1;
    generations.set(cacheKey, generation);
    pendingGenerations.set(cacheKey, generation);
    evictForNewEntry();

    const isCurrent = () =>
      generations.get(cacheKey) === generation &&
      pendingGenerations.get(cacheKey) === generation;

    const thumbnailPromise = (async () => {
      try {
        const [engine, document] = await Promise.all([
          loadEngine(),
          loadDocument(url),
        ]);
        const page = document.pages[pageIndex];
        if (!page) return null;

        const blob = await engine
          .renderThumbnail(document, page, {
            dpr,
            imageType: "image/png",
            scaleFactor: width / page.size.width,
            withAnnotations: true,
          })
          .toPromise();

        const objectUrl = createObjectURL(blob);
        if (!isCurrent()) {
          revokeObjectURL(objectUrl);
          return cache.get(cacheKey) ?? null;
        }

        evictForNewEntry();
        const previousUrl = cache.get(cacheKey);
        if (previousUrl) revokeObjectURL(previousUrl);
        cache.set(cacheKey, objectUrl);
        pending.delete(cacheKey);
        pendingGenerations.delete(cacheKey);
        touch(cacheKey);
        return objectUrl;
      } finally {
        if (pendingGenerations.get(cacheKey) === generation) {
          pending.delete(cacheKey);
          pendingGenerations.delete(cacheKey);
        }
      }
    })();

    pending.set(cacheKey, thumbnailPromise);
    return thumbnailPromise;
  };

  return {
    clear() {
      for (const cachedUrl of cache.values()) {
        if (cachedUrl) revokeObjectURL(cachedUrl);
      }
      cache.clear();
      pending.clear();
      pendingGenerations.clear();
      settledOrder.clear();
      generations.clear();
    },
    renderThumbnailUrl,
  };
}

export function getPdfSourceUrl(src: string) {
  if (/^\s*JVBERi0/.test(src) && !/[^A-Za-z0-9+/=\s]/.test(src)) {
    return `data:application/pdf;base64,${src.replace(/\s/g, "")}`;
  }

  return src;
}

export function loadSharedPdfEngine() {
  sharedEnginePromise ??= import("@embedpdf/engines/pdfium-worker-engine").then(
    ({ createPdfiumEngine }) => createPdfiumEngine(PDFIUM_WASM_URL, {}),
  );

  return sharedEnginePromise;
}

export async function loadPdfDocument(url: string) {
  let documentPromise = pdfDocumentCache.get(url);

  if (!documentPromise) {
    documentPromise = loadSharedPdfEngine().then((engine) =>
      engine
        .openDocumentUrl(
          { id: url, url },
          { mode: url.startsWith("blob:") ? "full-fetch" : "auto" },
        )
        .toPromise(),
    );
    pdfDocumentCache.set(url, documentPromise);
  }

  return documentPromise;
}

export async function getPdfPageCount(url: string) {
  return (await loadPdfDocument(url)).pageCount;
}

const sharedThumbnailCache = createPdfThumbnailCache({
  createObjectURL: (blob) => URL.createObjectURL(blob),
  loadDocument: loadPdfDocument,
  loadEngine: loadSharedPdfEngine,
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
});

export function renderPdfThumbnailUrl(args: RenderThumbnailArgs) {
  return sharedThumbnailCache.renderThumbnailUrl(args);
}
