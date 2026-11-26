import { ConvexError } from "convex/values";

export function messageFromError(error: unknown, fallback: string) {
  if (
    error instanceof ConvexError &&
    typeof (error.data as { message?: unknown })?.message === "string"
  ) {
    return (error.data as { message: string }).message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function createOptimisticTempId() {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `optimistic-${uuid}`;
}
