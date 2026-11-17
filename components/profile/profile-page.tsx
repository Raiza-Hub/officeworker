"use client";

import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@/convex/_generated/api";
import { DangerZoneSection } from "@/components/profile/danger-zone-section";
import { ProfileIdentity } from "@/components/profile/profile-identity";
import { ProfileHeading } from "@/components/profile/profile-heading";
import {
  ProfileIdentityLoading,
  WorkspaceAccessSectionLoading,
} from "@/components/profile/profile-page-loading";
import { WorkspaceAccessSection } from "@/components/profile/workspace-access-section";

export function ProfilePage() {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.current,
    isAuthenticated ? {} : "skip",
  );
  const isLoading = currentUser === undefined;

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-160">
        <ProfileHeading />
        <div className="mt-8">
          {isLoading ? <ProfileIdentityLoading /> : <ProfileIdentity />}
        </div>
        {isLoading ? (
          <WorkspaceAccessSectionLoading />
        ) : (
          <WorkspaceAccessSection />
        )}
        <DangerZoneSection />
      </div>
    </div>
  );
}
