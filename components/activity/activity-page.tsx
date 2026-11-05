import { ActivityHeader } from "@/components/activity/activity-header";
import { ActivityView } from "@/components/activity/activity-view";

export function ActivityPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      <ActivityHeader />
      <ActivityView />
    </div>
  );
}
