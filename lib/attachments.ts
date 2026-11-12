import { readResponseError } from "@/lib/api-client";
import { BLOCKED_MEDIA_MESSAGE, isBlockedMediaFile } from "@/lib/blocked-media";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type ChatAttachment = {
  key: string;
  name: string;
  mediaType: string;
  size: number;
};

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
  return (await response.json()) as { url: string; key: string };
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
