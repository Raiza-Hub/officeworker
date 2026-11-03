import { IssuesHeader } from "@/components/issues/issues-header";
import { IssueLabelsView } from "@/components/issues/issue-labels-view";

export function IssuesPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-page-bg text-[#24252a]">
      <IssuesHeader />
      <IssueLabelsView />
    </div>
  );
}
