import type * as React from "react";
import type { DocumentUploadItem } from "./types";

export function patchItem(
  setItems: React.Dispatch<React.SetStateAction<DocumentUploadItem[]>>,
  id: string,
  patch: Partial<DocumentUploadItem>,
) {
  setItems((current) =>
    current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  );
}

export async function deleteUploadedObject(storageKey: string) {
  await fetch("/api/documents/object", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: storageKey }),
  }).catch(() => undefined);
}

export function isNoSuchUploadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return message.toLowerCase().includes("upload session not found");
}
