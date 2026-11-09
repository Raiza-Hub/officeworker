import { components } from "./_generated/api";
import { defineNotifications } from "convex-notification";
import { v } from "convex/values";

const notificationData = v.object({
  title: v.string(),
  body: v.string(),
  href: v.string(),
});

export const notifications = defineNotifications(components.notification, {
  defaultListLimit: 20,
  kinds: {
    action_required: notificationData,
    agent_reply: notificationData,
    review_ready: notificationData,
    submission_completed: notificationData,
    billing: notificationData,
    document_ready: notificationData,
  },
});
