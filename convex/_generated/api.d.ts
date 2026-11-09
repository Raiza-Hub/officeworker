/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agentTools from "../agentTools.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as chat from "../chat.js";
import type * as chatActions from "../chatActions.js";
import type * as documents from "../documents.js";
import type * as encryption from "../encryption.js";
import type * as http from "../http.js";
import type * as notification_client from "../notification_client.js";
import type * as notifications from "../notifications.js";
import type * as r2 from "../r2.js";
import type * as submissions from "../submissions.js";
import type * as triggerActions from "../triggerActions.js";
import type * as users from "../users.js";
import type * as workspace from "../workspace.js";
import type * as workspaceActions from "../workspaceActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentTools: typeof agentTools;
  auth: typeof auth;
  billing: typeof billing;
  chat: typeof chat;
  chatActions: typeof chatActions;
  documents: typeof documents;
  encryption: typeof encryption;
  http: typeof http;
  notification_client: typeof notification_client;
  notifications: typeof notifications;
  r2: typeof r2;
  submissions: typeof submissions;
  triggerActions: typeof triggerActions;
  users: typeof users;
  workspace: typeof workspace;
  workspaceActions: typeof workspaceActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  notification: import("convex-notification/_generated/component.js").ComponentApi<"notification">;
};
