"use client";

import { createContext, useContext } from "react";

export type ComposerPrefill = {
  prefill: (text: string) => void;
};

export const ComposerPrefillContext = createContext<ComposerPrefill>({
  prefill: () => undefined,
});

export function useComposerPrefill(): ComposerPrefill {
  return useContext(ComposerPrefillContext);
}
