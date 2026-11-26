/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agent from "../agent.js";
import type * as agentFiles from "../agentFiles.js";
import type * as agentFilesDb from "../agentFilesDb.js";
import type * as agentTools from "../agentTools.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as browserUse from "../browserUse.js";
import type * as browserUseJobs from "../browserUseJobs.js";
import type * as chat from "../chat.js";
import type * as chatActions from "../chatActions.js";
import type * as cleanup from "../cleanup.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as encryption from "../encryption.js";
import type * as fx from "../fx.js";
import type * as http from "../http.js";
import type * as paymentReports from "../paymentReports.js";
import type * as portalAdapter from "../portalAdapter.js";
import type * as r2 from "../r2.js";
import type * as submissions from "../submissions.js";
import type * as users from "../users.js";
import type * as workspace from "../workspace.js";
import type * as workspaceActions from "../workspaceActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agent: typeof agent;
  agentFiles: typeof agentFiles;
  agentFilesDb: typeof agentFilesDb;
  agentTools: typeof agentTools;
  auth: typeof auth;
  billing: typeof billing;
  browserUse: typeof browserUse;
  browserUseJobs: typeof browserUseJobs;
  chat: typeof chat;
  chatActions: typeof chatActions;
  cleanup: typeof cleanup;
  credits: typeof credits;
  crons: typeof crons;
  documents: typeof documents;
  encryption: typeof encryption;
  fx: typeof fx;
  http: typeof http;
  paymentReports: typeof paymentReports;
  portalAdapter: typeof portalAdapter;
  r2: typeof r2;
  submissions: typeof submissions;
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
};
