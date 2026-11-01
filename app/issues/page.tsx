import type { Metadata } from "next";
import { IssuesPage } from "@/components/issues/issues-page";

export const metadata: Metadata = {
  title: "Issues | Officeworker",
};

export default function Page() {
  return <IssuesPage />;
}
