"use client";

import { useEffect, useRef } from "react";

type ChatHistoryRenameFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ChatHistoryRenameForm({
  value,
  onChange,
  onSave,
  onCancel,
}: ChatHistoryRenameFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      className="flex min-w-0 flex-1 items-center"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        maxLength={120}
        aria-label="Chat name"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onSave}
        className="h-7 min-w-0 flex-1 rounded-[7px] border-[0.5px] border-[lch(86%_0_282)] bg-white px-2 text-[13px] leading-normal font-medium text-[#292a30] placeholder:text-[#a6a7ad] shadow-[inset_0_1px_2px_lch(0_0_0/0.05)] outline-none transition-[border-color,box-shadow] focus:border-[#626bd9] focus:ring-2 focus:ring-[#626bd9]/20"
      />
    </form>
  );
}
