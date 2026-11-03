import { IssueLabelsTable } from "@/components/issues/issue-labels-table";
import { IssueLabelsToolbar } from "@/components/issues/issue-labels-toolbar";

export function IssueLabelsView() {
  return (
    <section aria-label="Issue labels" className="min-h-0 flex-1 overflow-auto">
      <IssueLabelsToolbar />
      <IssueLabelsTable />
    </section>
  );
}
