"use client";

import Image from "next/image";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@/convex/_generated/api";

const profileRowDividerClassName =
  "relative after:pointer-events-none after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-[#e5e5e8] last:after:hidden";

function ProfilePictureRow({
  image,
  initials,
}: {
  image?: string | null;
  initials: string;
}) {
  return (
    <li className={`${profileRowDividerClassName} flex h-[66px] items-center justify-between px-4`}>
      <span className="text-[13px] leading-none font-medium text-[#292a30]">
        Profile picture
      </span>
      <button
        type="button"
        aria-label="Change profile picture"
        className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full bg-[#00c3a1] text-[15px] leading-none font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2"
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>
    </li>
  );
}

function EmailRow({ email }: { email: string }) {
  return (
    <li className={`${profileRowDividerClassName} flex h-[60px] items-center justify-between gap-3 px-4`}>
      <span className="text-[13px] leading-none font-medium text-[#292a30]">
        Email
      </span>
      <span className="truncate text-[13px] leading-none text-[#303137]">
        {email}
      </span>
    </li>
  );
}

function FullNameRow({ fullName }: { fullName: string }) {
  return (
    <li className={`${profileRowDividerClassName} flex h-[64px] items-center justify-between gap-4 px-4`}>
      <span className="text-[13px] leading-none font-medium text-[#292a30]">
        Full name
      </span>
      <span className="truncate text-[13px] leading-none text-[#303137]">
        {fullName}
      </span>
    </li>
  );
}

export function ProfileDetailsCard() {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.current,
    isAuthenticated ? {} : "skip",
  );
  const fullName = currentUser?.name ?? "";
  const email = currentUser?.email ?? "";
  const image = currentUser?.image ?? null;
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <section
      aria-label="Profile details"
      className="overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.09),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]"
    >
      <ul className="m-0 list-none p-0">
        <ProfilePictureRow image={image} initials={initials} />
        <EmailRow email={email} />
        <FullNameRow fullName={fullName} />
      </ul>
    </section>
  );
}
