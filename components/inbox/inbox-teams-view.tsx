import { InboxTeamTable } from "@/components/inbox/inbox-team-table";
import { InboxTeamsToolbar } from "@/components/inbox/inbox-teams-toolbar";

export function InboxTeamsView() {
  return (
    <section aria-label="Inbox teams" className="min-h-0 flex-1 overflow-auto bg-agent-page-bg">
      <div className="w-full px-[18px] pt-2 pb-10">
        <InboxTeamsToolbar />
        <InboxTeamTable />
      </div>
    </section>
  );
}
