import { IssueGroup } from "@/components/issues/issue-group";
import { IssuesHeader } from "@/components/issues/issues-header";
import { IssuesViewBar } from "@/components/issues/issues-view-bar";
import type { Issue } from "@/components/issues/issue-row";

const issues: Issue[] = [
  { id: "WIS-1", title: "Get familiar with Linear", created: "Oct 29" },
  { id: "WIS-4", title: "Set up your teams", created: "Oct 29" },
  { id: "WIS-2", title: "Connect your tools", created: "Oct 29" },
  { id: "WIS-3", title: "Import your data", created: "Oct 29" },
];

export function IssuesPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      <IssuesHeader />
      <IssuesViewBar />
      <div className="min-h-0 flex-1 overflow-auto">
        <IssueGroup title="Todo" issues={issues} />
      </div>
    </div>
  );
}
