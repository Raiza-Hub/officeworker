import { describe, expect, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { AgentChatNotices } from "../components/agent/agent-chat-notices";
import type {
  BillingNoticeData,
} from "../components/agent/billing-notice";
import type { EditingMessage } from "../store/edit-message";

const editing: EditingMessage = {
  id: "message-1",
  order: 0,
  prompt: "old prompt",
  attachments: [],
  originalAttachments: [],
  previousPrompt: "",
  previousAttachments: [],
  activeTurn: null,
};

const billingNotice: BillingNoticeData = {
  code: "WALLET_EMPTY",
  message: "No credits",
};

function childrenOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const children = Array.isArray(node.props.children)
    ? node.props.children
    : [node.props.children];
  return children.filter((child): child is ReactElement<Record<string, unknown>> =>
    isValidElement<Record<string, unknown>>(child),
  );
}

describe("AgentChatNotices", () => {
  test("renders the edit notice before the billing notice", () => {
    const notices = AgentChatNotices({
      editing,
      notice: billingNotice,
      onCancelEdit: () => undefined,
      onDismissNotice: () => undefined,
    });
    const children = childrenOf(notices);

    expect(children).toHaveLength(2);
    expect(children[0]?.key).toBe("edit:message-1");
    expect(children[0]?.props.dismissLabel).toBe("Cancel editing");
    expect(children[1]?.key).toBe("WALLET_EMPTY");
    expect(children[1]?.props.notice).toEqual(billingNotice);
  });

  test("renders a file edit notice that can be dismissed", () => {
    let dismissed = false;
    const notices = AgentChatNotices({
      editing: null,
      notice: null,
      fileEditPrefix: "@report.xlsx ",
      onCancelEdit: () => undefined,
      onDismissNotice: () => undefined,
      onDismissFileEdit: () => {
        dismissed = true;
      },
    });
    const children = childrenOf(notices);

    expect(children).toHaveLength(1);
    expect(children[0]?.key).toBe("file-edit:@report.xlsx");
    expect(children[0]?.props.notice).toEqual({
      code: "EDITING",
      message: "Editing ",
      highlight: "@report.xlsx",
    });
    expect(children[0]?.props.dismissLabel).toBe("Close file editing");
    (children[0]?.props.onDismiss as () => void)();
    expect(dismissed).toBe(true);
  });
});
