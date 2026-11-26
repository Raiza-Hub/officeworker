"use client";

import { createContext, useContext } from "react";
import type { EditMessage } from "./types";

export const EditMessageContext = createContext<EditMessage>({
  editing: null,
  startEdit: () => undefined,
  cancelEdit: () => undefined,
});

export function useEditMessage(): EditMessage {
  return useContext(EditMessageContext);
}
