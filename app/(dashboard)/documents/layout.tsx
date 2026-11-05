import type { ReactNode } from "react";
import { DocumentToaster } from "@/components/documents/document-toaster";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DocumentToaster />
    </>
  );
}
