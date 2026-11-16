import { readResponseError } from "@/lib/api-client";
import { BLOCKED_MEDIA_MESSAGE, isBlockedMediaFile } from "@/lib/blocked-media";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;
export const DEFAULT_PART_SIZE_BYTES = 8 * 1024 * 1024;

export type ChatAttachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

export type MultipartPresign = {
  mode: "multipart";
  key: string;
  uploadId: string;
  partSize: number;
  partUrls: Record<number, string>;
};

export type SinglePresign = {
  mode: "single";
  url: string;
  key: string;
};

export type PresignResult = MultipartPresign | SinglePresign;

export class UploadCanceledError extends Error {
  constructor(message = "Upload canceled") {
    super(message);
    this.name = "UploadCanceledError";
  }
}

export function attachmentFingerprint(file: {
  name: string;
  size: number;
  mediaType?: string;
  type?: string;
}) {
  return `${file.name}\u0000${file.size}\u0000${file.mediaType ?? file.type ?? "application/octet-stream"}`;
}

export async function presignUpload(file: {
  name: string;
  size: number;
  type: string;
}): Promise<{ url: string; key: string }> {
  const response = await fetch("/api/documents/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
    }),
  });
  if (!response.ok) {
    throw new Error(
      await readResponseError(
        response,
        `Could not prepare upload (${response.status})`,
      ),
    );
  }
  const json = (await response.json()) as { url: string; key: string };
  return { url: json.url, key: json.key };
}

export async function presignDocumentUpload(
  file: {
    name: string;
    size: number;
    type: string;
  },
  signal?: AbortSignal,
): Promise<PresignResult> {
  const wantsMultipart = file.size >= MULTIPART_THRESHOLD_BYTES;
  const response = await fetch("/api/documents/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      wantsMultipart,
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(
      await readResponseError(
        response,
        `Could not prepare upload (${response.status})`,
      ),
    );
  }
  const json = (await response.json()) as PresignResult | { url: string; key: string };
  if ("mode" in json) return json as PresignResult;
  return { mode: "single", url: json.url, key: json.key };
}

export async function putObjectToR2(
  url: string,
  file: File | Blob,
  contentType: string,
) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? "R2 rejected the upload (403). Check the bucket CORS policy and Content-Type, then try again."
        : `R2 upload failed (${response.status})`,
    );
  }
}

export function putObjectToR2WithProgress(
  url: string,
  file: File | Blob,
  contentType: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            xhr.status === 403
              ? "R2 rejected the upload (403). Check the bucket CORS policy and Content-Type, then try again."
              : `R2 upload failed (${xhr.status})`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("The upload request failed"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(signal?.reason ?? new UploadCanceledError());
    };

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

export async function uploadChatAttachment(file: File): Promise<ChatAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is larger than 25MB`);
  }
  if (isBlockedMediaFile(file)) {
    throw new Error(BLOCKED_MEDIA_MESSAGE);
  }
  const contentType = file.type || "application/octet-stream";
  const presign = await presignUpload({
    name: file.name,
    size: file.size,
    type: contentType,
  });
  await putObjectToR2(presign.url, file, contentType);
  return {
    key: presign.key,
    name: file.name,
    mediaType: contentType,
    size: file.size,
  };
}

export type UploadedPartInfo = { number: number; etag: string; size: number };

export async function listUploadedParts(
  key: string,
  uploadId: string,
  totalParts?: number,
): Promise<{ parts: UploadedPartInfo[]; partUrls: Record<number, string> }> {
  const params = new URLSearchParams({ key, uploadId });
  if (totalParts != null) params.set("total", String(totalParts));
  const response = await fetch(`/api/documents/upload-parts?${params.toString()}`);
  if (!response.ok) {
    throw new Error(
      await readResponseError(response, `Failed to list upload parts (${response.status})`),
    );
  }
  return (await response.json()) as {
    parts: UploadedPartInfo[];
    partUrls: Record<number, string>;
  };
}

export async function completeMultipartUpload(key: string, uploadId: string): Promise<{ size: number | null }> {
  const response = await fetch("/api/documents/upload-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, uploadId }),
  });
  if (!response.ok) {
    throw new Error(
      await readResponseError(response, `Failed to complete upload (${response.status})`),
    );
  }
  return (await response.json()) as { size: number | null };
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  await fetch("/api/documents/upload-abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, uploadId }),
  }).catch(() => undefined);
}

export async function checkObjectExists(key: string): Promise<boolean> {
  const params = new URLSearchParams({ key });
  const response = await fetch(`/api/documents/object?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to check object (${response.status})`);
  const json = (await response.json()) as { exists: boolean };
  return json.exists;
}

export function planPartCount(size: number, partSize: number): number {
  return Math.max(1, Math.ceil(size / partSize));
}

export function partRange(partNumber: number, partSize: number, totalSize: number): { start: number; end: number; size: number } {
  const start = (partNumber - 1) * partSize;
  const end = Math.min(start + partSize, totalSize);
  return { start, end, size: end - start };
}

function putPartWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            xhr.status === 403
              ? "R2 rejected the upload (403). Check the bucket CORS policy and Content-Type, then try again."
              : `R2 upload failed (${xhr.status})`,
          ),
        );
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("The upload request failed"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(signal?.reason ?? new UploadCanceledError());
    };
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(blob);
  });
}

const PART_RETRY_DELAYS = [500, 1000, 2000];

export async function uploadMultipartResumable(args: {
  file: Blob;
  key: string;
  uploadId: string;
  contentType: string;
  partSize: number;
  partUrls: Record<number, string>;
  uploadedParts: UploadedPartInfo[];
  onProgress: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { file, contentType, partSize, partUrls, uploadedParts, onProgress, signal } = args;
  signal?.throwIfAborted();
  const totalSize = file.size;
  const totalParts = planPartCount(totalSize, partSize);

  const uploadedByNumber = new Map<number, UploadedPartInfo>();
  for (const part of uploadedParts) uploadedByNumber.set(part.number, part);

  const doneNumbers = new Set<number>();
  let completedBytes = 0;
  for (let n = 1; n <= totalParts; n++) {
    const range = partRange(n, partSize, totalSize);
    const existing = uploadedByNumber.get(n);
    if (existing && existing.size === range.size) {
      doneNumbers.add(n);
      completedBytes += range.size;
    }
  }

  const partLoaded = new Map<number, number>();
  const emitProgress = () => {
    let inflight = 0;
    for (const loaded of partLoaded.values()) inflight += loaded;
    const percent = Math.round(((completedBytes + inflight) / totalSize) * 100);
    onProgress(Math.max(0, Math.min(100, percent)));
  };

  emitProgress();

  const queue: number[] = [];
  for (let n = 1; n <= totalParts; n++) {
    if (!doneNumbers.has(n)) queue.push(n);
  }

  const concurrency = 3;
  let cursor = 0;

  async function uploadPart(partNumber: number): Promise<void> {
    signal?.throwIfAborted();
    const url = partUrls[partNumber];
    if (!url) throw new Error(`Missing upload URL for part ${partNumber}`);
    const range = partRange(partNumber, partSize, totalSize);
    const blob = file.slice(range.start, range.end);

    for (let attempt = 0; attempt <= PART_RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, PART_RETRY_DELAYS[attempt - 1]));
        signal?.throwIfAborted();
      }
      partLoaded.set(partNumber, 0);
      try {
        await putPartWithProgress(
          url,
          blob,
          contentType,
          (loaded) => {
            partLoaded.set(partNumber, Math.min(loaded, range.size));
            emitProgress();
          },
          signal,
        );
        partLoaded.delete(partNumber);
        completedBytes += range.size;
        emitProgress();
        return;
      } catch (error) {
        partLoaded.set(partNumber, 0);
        emitProgress();
        if (attempt === PART_RETRY_DELAYS.length) throw error;
      }
    }
  }

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      signal?.throwIfAborted();
      const index = cursor++;
      await uploadPart(queue[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
  onProgress(100);
}
