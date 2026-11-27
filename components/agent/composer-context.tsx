"use client";

import { createContext, useContext } from "react";

export type ComposerPrefill = {
  prefill: (
    text: string,
    options?: { focus?: boolean; highlight?: boolean },
  ) => void;
  startFileEdit: (fileName: string) => void;
};

export const ComposerPrefillContext = createContext<ComposerPrefill>({
  prefill: () => undefined,
  startFileEdit: () => undefined,
});

export function useComposerPrefill(): ComposerPrefill {
  return useContext(ComposerPrefillContext);
}
