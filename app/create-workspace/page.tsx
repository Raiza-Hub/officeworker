import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = {
  title: "Create a workspace | Officeworker",
  description: "Create your workspace with Officeworker.",
};

export default function CreateWorkspacePage() {
  return (
    <>
      <Suspense fallback={null}>
        <ConnectedWorkspaceRedirect />
      </Suspense>
      <WorkspaceForm />
    </>
  );
}

async function ConnectedWorkspaceRedirect() {
  await connection();

  const token = await convexAuthNextjsToken();
  if (!token) return null;

  const status = await fetchQuery(api.workspace.getStatus, {}, { token });
  if (status?.status === "connected") {
    redirect("/agent");
  }

  return null;
}
