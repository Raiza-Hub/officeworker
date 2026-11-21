import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge stale draft threads",
  { hourUTC: 3 },
  internal.cleanup.cleanupStaleDraftThreads,
  {},
);

export default crons;
