"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

function WorkspaceAccessCard() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const currentUser = useQuery(api.users.current);
  const displayName = currentUser?.name?.trim() || currentUser?.email || "";

  async function handleSignOut() {
    setIsPending(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="group flex h-[65px] items-center justify-between gap-3 rounded-[10px] bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.09),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]">
      <div className="min-w-0">
        <div className="truncate text-[13px] leading-[15.5px] font-medium text-[#292a30]">
          Officeworker
        </div>
        <div className="mt-0.5 flex min-w-0 items-center text-[12px] leading-[15.5px] font-[450]">
          <span className="inline-flex min-w-0 items-center text-[#3f9f4d]">
            <span aria-hidden="true" className="mr-1 size-1.5 rounded-full bg-[#3fbd54]" />
            <span>Connected</span>
          </span>
          {displayName ? (
            <>
              <span aria-hidden="true" className="mx-1.5 text-[#777a82]">
                ·
              </span>
              <span className="truncate text-[#777a82]">{displayName}</span>
            </>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] leading-none font-medium text-[#303137] opacity-0 transition-[background-color,opacity] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#f0f0f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 disabled:cursor-wait disabled:opacity-60"
      >
        Log out
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
