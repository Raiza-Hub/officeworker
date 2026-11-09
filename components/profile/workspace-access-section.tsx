"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";

function WorkspaceAccessCard() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const connection = useQuery(api.workspace.getStatus, {});
  const disconnectConnection = useMutation(api.workspace.disconnectConnection);
  const isLoading = connection === undefined;
  const connectedPortal = connection?.status === "connected" ? connection : null;
  const isConnected = connectedPortal !== null;

  async function handleAction() {
    if (!connectedPortal) {
      router.push("/create-workspace");
      return;
    }

    setIsPending(true);
    try {
      await disconnectConnection({ portalKey: connectedPortal.portalKey });
      toast.success("Workspace disconnected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect workspace");
    } finally {
      setIsPending(false);
    }
  }

  const workspaceLabel = isLoading
    ? "Checking connection…"
    : connectedPortal
      ? connectedPortal.portalUrl
      : "Not connected";
  const statusLabel = connectedPortal
    ? connectedPortal.portalEmail
    : connection?.status === "error"
      ? connection.lastError || "Connection needs attention"
      : "Connect a teacher portal to use uploads";

  return (
    <div className="flex min-h-[65px] items-center justify-between gap-3 rounded-[10px] bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.09),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]">
      <div className="min-w-0">
        <div className="truncate text-[13px] leading-[15.5px] font-medium text-[#292a30]">
          {workspaceLabel}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center text-[12px] leading-[15.5px] font-[450]">
          <span
            aria-hidden="true"
            className={`mr-1 size-1.5 shrink-0 rounded-full ${connectedPortal ? "bg-[#3fbd54]" : connection?.status === "error" ? "bg-[#d99b27]" : "bg-[#a0a3aa]"}`}
          />
          <span className={`truncate ${connectedPortal ? "text-[#3f9f4d]" : "text-[#777a82]"}`}>
            {connectedPortal ? `Connected · ${statusLabel}` : statusLabel}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleAction()}
        disabled={isLoading || isPending}
        className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] leading-none font-medium text-[#303137] transition-colors hover:bg-[#f0f0f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 disabled:cursor-wait disabled:opacity-60"
      >
        {isConnected ? "Log out" : "Connect"}
      </button>
    </div>
  );
}

export function WorkspaceAccessSection() {
  return (
    <section aria-labelledby="workspace-access-heading" className="mt-9 pt-3">
      <h2
        id="workspace-access-heading"
        className="m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-[#292a30]"
      >
        Workspace access
      </h2>
      <p className="m-0 mt-1 px-4 text-[13px] leading-[22px] font-[450] text-[#777a82]">
        Manage your access to this workspace
      </p>
      <div className="mt-4">
        <WorkspaceAccessCard />
      </div>
    </section>
  );
}
