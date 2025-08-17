import { initLogger } from "@utils/logger";
import { safeShutdown, ValKey } from "@utils/valkey";

const LOG = initLogger("reaper");

const host = process.env.KV_HOST || "valkey";
const port = Number(process.env.KV_PORT || 6379);
const QUEUE_MAIN = process.env.QUEUE_MAIN || "q:main";
const QUEUE_PROCESSING = process.env.QUEUE_PROCESSING || "q:processing";
const QUEUE_ERROR = process.env.QUEUE_ERROR || "q:error";
const STALE_MS = Number(process.env.STALE_MS || 60_000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 5);
const SCAN_INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS || 10_000);

const valkey = new ValKey({ host, port });

async function reapOnce() {
  const items = await valkey.lrange(QUEUE_PROCESSING, 0, -1); // O(N)
  const now = Date.now();
  let inspected = 0,
    reaped = 0,
    sentToError = 0;

  for (const s of items) {
    inspected++;
    let job;
    try {
      job = JSON.parse(s);
    } catch {
      continue;
    }

    if (!job.startedAt) continue;
    const age = now - job.startedAt;
    if (age < STALE_MS) continue;

    job.retries = (job.retries ?? 0) + 1;
    delete job.startedAt;
    const updated = JSON.stringify(job);

    const multi = valkey.multi();
    multi.lrem(QUEUE_PROCESSING, 1, s);
    if (job.retries > MAX_RETRIES) {
      job.error = {
        message: "max retries exceeded",
        ts: new Date().toISOString(),
      };
      multi.lpush(QUEUE_ERROR, JSON.stringify(job));
    } else {
      multi.rpush(QUEUE_MAIN, updated);
    }
    try {
      await multi.exec();
      if (job.retries > MAX_RETRIES) {
        sentToError++;
      } else {
        reaped++;
      }
      LOG.info(
        `Reaped ${job.id ?? "(no id)"} age=${age}ms retries=${
          job.retries
        }`
      );
    } catch (e) {
      LOG.error("multi.exec failed:", e);
    }
  }

  return { inspected, reaped, sentToError };
}

process.on("SIGINT", () => safeShutdown([valkey], "SIGINT", LOG));
process.on("SIGTERM", () => safeShutdown([valkey], "SIGTERM", LOG));
process.on("uncaughtException", (e) => {
  LOG.error("uncaughtException:", e);
  safeShutdown([valkey], "uncaughtException", LOG);
});
process.on("unhandledRejection", (e) => {
  LOG.error("unhandledRejection:", e);
  safeShutdown([valkey], "unhandledRejection", LOG);
});

let running = false;
setInterval(async () => {
  if (running) return;
  running = true;
  try {
    const { inspected, reaped, sentToError } = await reapOnce();
    if (reaped || sentToError) {
      LOG.info(
        `sweep: inspected=${inspected} reaped=${reaped} sentToError=${sentToError}`
      );
    }
  } catch (err) {
    LOG.error("sweep error:", err);
  } finally {
    running = false;
  }
}, SCAN_INTERVAL_MS);
LOG.info("started");