import { DangerZoneSection } from "@/components/profile/danger-zone-section";
import { ProfileHeading } from "@/components/profile/profile-heading";

const sectionHeadingClassName =
  "m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-[#292a30]";

const cardBlockClassName = "animate-pulse rounded-[10px] bg-[#f3f3f4]";

export function ProfileDetailsCardLoading() {
  return <div className={`h-[190px] ${cardBlockClassName}`} />;
}

export function WorkspaceAccessSectionLoading() {
  return (
    <section className="mt-9 pt-3">
      <h2 className={sectionHeadingClassName}>Workspace access</h2>
      <p className="m-0 mt-1 px-4 text-[13px] leading-[22px] font-[450] text-[#777a82]">
        Manage your access to this workspace
      </p>
      <div className={`mt-4 h-[65px] ${cardBlockClassName}`} />
    </section>
  );
}

export function ProfilePageLoading() {
  return (
    <div className="h-full overflow-y-auto overscroll-contain px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-[640px]">
        <ProfileHeading />
        <div className="mt-8">
          <ProfileDetailsCardLoading />
        </div>
        <WorkspaceAccessSectionLoading />
        <DangerZoneSection />
      </div>
    </div>
  );
}
