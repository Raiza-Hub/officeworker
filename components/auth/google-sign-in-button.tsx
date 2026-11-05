"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function GoogleSignInButton() {
  const { signIn } = useAuthActions();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setIsPending(true);
    setError(null);

    try {
      await signIn("google", { redirectTo: "/create-workspace" });
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isPending}
        className="mx-auto inline-flex h-[44px] w-[288px] max-w-full items-center justify-center rounded-full bg-[#6069d9] px-4 text-[13px] leading-normal font-medium text-white transition-[background-color,transform] duration-150 hover:bg-[#535dcd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9] focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
      >
        {isPending ? "Connecting…" : "Continue with Google"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
