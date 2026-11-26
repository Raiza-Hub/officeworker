"use client";

import { Loader } from "lucide-react";

export function ThreadLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start px-6 pt-6">
      <p
        role="status"
        className="mx-auto mt-0 mb-0 flex w-full max-w-178 items-center justify-start gap-1.5 text-left text-[13px] text-muted-foreground"
      >
        <Loader
          aria-hidden="true"
          className="size-3.5 animate-spin [animation-duration:0.7s]"
          strokeWidth={2}
        />
        Loading conversation…
      </p>
    </div>
  );
}
