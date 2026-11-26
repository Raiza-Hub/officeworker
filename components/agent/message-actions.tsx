"use client";

import { Check, Copy, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type MessageActionsProps = {
  text: string;
  onEdit?: () => void;
  revealGroup?: "prompt" | "message";
};

export function MessageActions({
  text,
  onEdit,
  revealGroup = "message",
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy message");
    }
  }

  const revealClasses =
    revealGroup === "prompt"
      ? "group-hover/prompt:opacity-100 group-focus-within/prompt:opacity-100"
      : "group-hover/message:opacity-100 group-focus-within/message:opacity-100";

  return (
    <div
      className={`flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 ${revealClasses} focus-within:opacity-100`}
    >
      {text && (
        <button
          type="button"
          onClick={() => void copyText()}
          aria-label={copied ? "Copied message" : "Copy message"}
          title={copied ? "Copied" : "Copy"}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[#8a8d95] transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          ) : (
            <Copy aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          )}
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit message"
          title="Edit"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[#8a8d95] transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Pencil aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
