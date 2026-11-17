import { DangerZoneSection } from "@/components/profile/danger-zone-section";
import { ProfileHeading } from "@/components/profile/profile-heading";

const sectionHeadingClassName =
  "m-0 h-[23px] px-4 text-[15px] leading-[23px] font-medium text-ink-soft";

export function ProfileIdentityLoading() {
  return (
    <div className="flex flex-col items-center">
      <div className="size-24 animate-pulse rounded-full bg-secondary" />
      <div className="mt-4 h-5 w-40 animate-pulse rounded-md bg-secondary" />
      <div className="mt-1 h-4 w-52 animate-pulse rounded-md bg-secondary" />
    </div>
  );
}

export function WorkspaceAccessSectionLoading() {
  return (
    <section className="mt-9 pt-3">
      <h2 className={sectionHeadingClassName}>Workspace access</h2>
      <p className="m-0 mt-1 px-4 text-[13px] leading-5.5 font-[450] text-text-tertiary">
        Manage your access to this workspace
      </p>
      <div className="mt-4 h-16 animate-pulse rounded-lg bg-secondary" />
    </section>
  );
}

export function ProfilePageLoading() {
  return (
    <div className="h-full overflow-y-auto overscroll-contain px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-160">
        <ProfileHeading />
        <div className="mt-8">
          <ProfileIdentityLoading />
        </div>
        <WorkspaceAccessSectionLoading />
        <DangerZoneSection />
      </div>
    </div>
  );
}
