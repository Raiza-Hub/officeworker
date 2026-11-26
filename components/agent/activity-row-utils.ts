import {
  FileSearch,
  FileText,
  ListChecks,
  Pencil,
  PlugZap,
  RefreshCcw,
  RotateCcw,
  Send,
  Upload,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export const TOOL_ICONS: Record<string, LucideIcon> = {
  get_connection_status: PlugZap,
  check_wallet_balance: Wallet,
  create_portal_job: Upload,
  continue_portal_job: Upload,
  get_submissions: ListChecks,
  sync_submission_job: RefreshCcw,
  read_file: FileSearch,
  edit_file: Pencil,
  set_upload_candidate: FileText,
  approve_submission: Send,
  retry_submission: RotateCcw,
  cancel_submission: XCircle,
};

function stringArg(input: unknown, key: string): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function toolLabel(
  toolName: string,
  input: unknown,
): { active: string; done: string } {
  switch (toolName) {
    case "get_connection_status":
      return { active: "Checking portal connection…", done: "Checked portal connection" };
    case "check_wallet_balance":
      return { active: "Checking wallet balance…", done: "Checked wallet balance" };
    case "create_portal_job":
      return { active: "Starting portal job…", done: "Started portal job" };
    case "continue_portal_job":
      return { active: "Continuing portal job…", done: "Continued portal job" };
    case "get_submissions":
      return { active: "Reading submissions…", done: "Read submissions" };
    case "sync_submission_job":
      return { active: "Syncing job status…", done: "Synced job status" };
    case "read_file": {
      const name = stringArg(input, "name") || "a file";
      return { active: `Reading ${name}…`, done: `Read ${name}` };
    }
    case "edit_file": {
      const name = stringArg(input, "name") || "a file";
      return { active: `Editing ${name}…`, done: `Edited ${name}` };
    }
    case "set_upload_candidate":
      return { active: "Setting upload candidate…", done: "Set upload candidate" };
    case "approve_submission":
      return { active: "Approving submission…", done: "Approved submission" };
    case "cancel_submission":
      return { active: "Cancelling submission…", done: "Cancelled submission" };
    case "retry_submission":
      return { active: "Retrying submission…", done: "Retried submission" };
    default: {
      const name = toolName.replace(/_/g, " ");
      return { active: `Using ${name}…`, done: `Used ${name}` };
    }
  }
}
