"use client";

import Image from "next/image";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@/convex/_generated/api";

export function ProfileIdentity() {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.current,
    isAuthenticated ? {} : "skip",
  );
  const fullName = currentUser?.name ?? "";
  const email = currentUser?.email ?? "";
  const image = currentUser?.image ?? null;
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <section
      aria-label="Profile details"
      className="flex flex-col items-center text-center"
    >
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-sidebar-avatar">
        {image ? (
          <Image
            src={image}
            alt=""
            width={96}
            height={96}
            loading="eager"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-4xl font-medium text-white">{initials}</span>
        )}
      </div>
      <h2 className="mt-4 text-xl font-bold text-foreground">{fullName}</h2>
      <p className="mt-1 max-w-full truncate text-sm font-medium text-text-tertiary">
        {email}
      </p>
    </section>
  );
}
