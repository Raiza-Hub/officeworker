import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import notification from "convex-notification/convex.config.js";

const app = defineApp();
app.use(agent);
app.use(notification);

export default app;
