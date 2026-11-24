import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge stale draft threads",
  { hourUTC: 3 },
  internal.cleanup.cleanupStaleDraftThreads,
  {},
);

crons.daily(
  "refresh USD NGN rate",
  { hourUTC: 0, minuteUTC: 10 },
  internal.fx.refreshFxRate,
  {},
);

crons.interval(
  "expire stale credit holds",
  { minutes: 10 },
  internal.credits.expireStaleReservations,
  {},
);

crons.interval(
  "process billing settlement outbox",
  { minutes: 1 },
  internal.credits.processSettlementOutbox,
  {},
);

export default crons;
