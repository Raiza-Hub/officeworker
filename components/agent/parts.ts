export type UIMessagePartList = Array<{
  type: string;
  [key: string]: unknown;
}>;

export function partText(part: { type: string; [key: string]: unknown }): string {
  if (part.type !== "text") return "";
  if (typeof part.text === "string") return part.text;
  if (Array.isArray(part.text) && typeof part.text[0] === "string") {
    return part.text[0];
  }
  return "";
}

export function reasoningText(part: { type: string; [key: string]: unknown }): string {
  if (part.type !== "reasoning") return "";
  if (typeof part.text === "string") return part.text;
  if (Array.isArray(part.text) && typeof part.text[0] === "string") {
    return part.text[0];
  }
  return "";
}

export function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-");
}

export function partState(part: { [key: string]: unknown }): string {
  return typeof part.state === "string" ? part.state : "";
}

export function isRunningPart(part: { [key: string]: unknown }): boolean {
  const state = partState(part);
  return (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested"
  );
}
