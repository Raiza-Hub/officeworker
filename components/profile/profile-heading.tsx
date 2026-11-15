import { HeaderSidebarTrigger } from "@/components/sidebar/sidebar-trigger";

export function ProfileHeading() {
  return (
    <div className="flex h-8 items-center gap-2 px-4">
      <HeaderSidebarTrigger />
      <h1 className="m-0 text-2xl leading-8 font-medium text-ink">
        Profile
      </h1>
    </div>
  );
}
