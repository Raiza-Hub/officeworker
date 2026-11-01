import { DangerZoneSection } from "@/components/profile/danger-zone-section";
import { ProfileDetailsCard } from "@/components/profile/profile-details-card";
import { ProfileHeading } from "@/components/profile/profile-heading";
import { WorkspaceAccessSection } from "@/components/profile/workspace-access-section";

export function ProfilePage() {
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-[640px]">
        <ProfileHeading />
        <div className="mt-8">
          <ProfileDetailsCard />
        </div>
        <WorkspaceAccessSection />
        <DangerZoneSection />
      </div>
    </div>
  );
}
