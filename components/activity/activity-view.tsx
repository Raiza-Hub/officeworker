import { ActivityTable } from "@/components/activity/activity-table";
import { ActivityToolbar } from "@/components/activity/activity-toolbar";

export function ActivityView() {
  return (
    <section aria-label="Activity labels" className="min-h-0 flex-1 overflow-auto">
      <ActivityToolbar />
      <ActivityTable />
    </section>
  );
}
