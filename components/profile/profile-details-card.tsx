"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const profileRowDividerClassName =
  "relative after:pointer-events-none after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-[#e5e5e8] last:after:hidden";

function ProfilePictureRow({ initials }: { initials: string }) {
  return (
    <li className={`${profileRowDividerClassName} flex h-[66px] items-center justify-between px-4`}>
      <span className="text-[13px] leading-none font-medium text-[#292a30]">
        Profile picture
      </span>
      <button
        type="button"
        aria-label="Change profile picture"
        className="inline-flex size-8 items-center justify-center rounded-full bg-[#00c3a1] text-[15px] leading-none font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2"
      >
        {initials}
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
        {email || "Loading…"}
      </span>
    </li>
  );
}

function ProfileFieldRow({
  id,
  label,
  helper,
  defaultValue,
  placeholder,
  rowHeight,
}: {
  id: string;
  label: string;
  helper?: string;
  defaultValue?: string;
  placeholder?: string;
  rowHeight: "h-[64px]" | "h-[65px]";
}) {
  return (
    <li className={`${profileRowDividerClassName} flex ${rowHeight} items-center justify-between gap-4 px-4 py-3`}>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <label
          htmlFor={id}
          className="text-[13px] leading-[16px] font-medium text-[#292a30]"
        >
          {label}
        </label>
        {helper && (
          <span className="text-[12px] font-[450] leading-[normal] text-[lch(40_1_282)]">
            {helper}
          </span>
        )}
      </div>
      <input
        id={id}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 w-[180px] max-w-[48%] shrink-0 rounded-[8px] border border-[#dedee2] bg-white px-3 text-[13px] leading-5 text-[#303137] outline-none placeholder:text-[#85878e] focus:border-[#b9bbc4] focus:ring-2 focus:ring-[#626bd9]/15"
      />
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
      <ul key={currentUser?._id ?? "profile-loading"} className="m-0 list-none p-0">
        <ProfilePictureRow initials={initials} />
        <EmailRow email={email} />
        <ProfileFieldRow
          id="profile-full-name"
          label="Full name"
          defaultValue={fullName}
          rowHeight="h-[64px]"
        />
      </ul>
    </section>
  );
}
