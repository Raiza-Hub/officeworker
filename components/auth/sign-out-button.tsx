"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

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
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      aria-label="Sign out"
      title="Sign out"
      className={`inline-flex h-7 items-center rounded-full text-[#4f525a] transition-colors duration-100 ease-out hover:bg-[#f3f3f4] hover:text-sidebar-foreground disabled:cursor-wait disabled:opacity-60 ${
        collapsed ? "w-7 justify-center" : "gap-1.5 px-2"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40 motion-reduce:transition-none`}
    >
      <LogOut aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
      {!collapsed && <span className="text-[12px] font-medium">Sign out</span>}
    </button>
  );
}
