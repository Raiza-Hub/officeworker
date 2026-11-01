import type { Metadata } from "next";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = {
  title: "Create a workspace | Officeworker",
  description: "Create your workspace with Officeworker.",
};

export default function CreateWorkspacePage() {
  return <WorkspaceForm />;
}
