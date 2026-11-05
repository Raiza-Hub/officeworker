"use client";

import { Search } from "lucide-react";
import { type FormEvent } from "react";

type DocumentToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
};

export function DocumentToolbar({ search, onSearchChange }: DocumentToolbarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="flex h-[34px] w-full shrink-0 items-center justify-start">
      <div className="flex items-center gap-1.5">
        <form
          role="search"
          className="relative flex h-[34px] w-[300px] items-center"
          onSubmit={handleSubmit}
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2 size-4 text-[#656870]"
            strokeWidth={2}
          />
          <input
            type="search"
            aria-label="Filter by name…"
            placeholder="Filter by name…"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-8 w-full rounded-lg border border-[#dedee3] bg-[#fff] px-[25px] pl-8 text-[13px] leading-4 font-medium text-[#34363c] outline-none transition-[border-color,box-shadow] placeholder:text-[#777a82] focus:border-[#6874db] focus:ring-2 focus:ring-[#6874db]/15"
          />
        </form>
      </div>
    </div>
  );
}
