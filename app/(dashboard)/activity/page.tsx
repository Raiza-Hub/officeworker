import type { Metadata } from "next";
import { ActivityPage } from "@/components/activity/activity-page";

export const metadata: Metadata = {
  title: "Activity | Officeworker",
};

export default function Page() {
  return <ActivityPage />;
}
