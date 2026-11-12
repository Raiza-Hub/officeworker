import { isToolPart, partText, type UIMessagePartList } from "@/components/agent/parts";

export type ThreadEntry = { key: string; kind: "text"; text: string };

export function historyMessageKey(message: {
  id: string;
  role?: string;
  order?: number;
  stepOrder?: number;
}) {
  if (message.role === "user" && message.order !== undefined) {
    return `user:${message.order}`;
  }
  return message.role === "assistant" && message.order !== undefined
    ? `assistant:${message.order}:${message.stepOrder ?? 0}`
    : `${message.role ?? "message"}:${message.id}`;
}

export function finalAssistantParts(parts: UIMessagePartList): UIMessagePartList {
  const lastToolIndex = parts.reduce(
    (lastIndex, part, index) => (isToolPart(part) ? index : lastIndex),
    -1,
  );
  return lastToolIndex < 0 ? parts : parts.slice(lastToolIndex + 1);
}

export function buildEntries(parts: UIMessagePartList): ThreadEntry[] {
  const entries: ThreadEntry[] = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    if (part.type === "text") {
      const text = partText(part);
      if (text) entries.push({ key: `text-${i}`, kind: "text", text });
      i += 1;
      continue;
    }
    if (part.type === "reasoning") {
      i += 1;
      continue;
    }
    i += 1;
  }
  return entries;
}

export function extractSubmissionIds(parts: UIMessagePartList): string[] {
  const text = parts.map(partText).join("");
  const ids: string[] = [];
  for (const match of text.matchAll(/\[submission:([a-z0-9]+)\]/gi)) {
    if (match[1]) ids.push(match[1]);
  }
  return [...new Set(ids)];
}
