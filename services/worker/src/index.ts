import { initLogger } from "@utils/logger";
import { safeShutdown, ValKey } from "@utils/valkey";
import type { Job } from "@types";

const LOG = initLogger("worker");

const host = process.env.KV_HOST || "valkey";
const port = Number(process.env.KV_PORT || 6379);
const QUEUE_MAIN = process.env.QUEUE_MAIN || "q:main";
const QUEUE_PROCESSING = process.env.QUEUE_PROCESSING || "q:processing";
const QUEUE_COMPLETED = process.env.QUEUE_COMPLETED || "q:completed";
const QUEUE_ERROR = process.env.QUEUE_ERROR || "q:error";

const valkeyBlock = new ValKey({ host, port, maxRetriesPerRequest: null });
const valkey = new ValKey({ host, port });

async function processJob(_payload: Job) {
  await new Promise((r) => setTimeout(r, 20)); // simulate work
  return { ok: true };
}

async function run() {
  LOG.info("started; waiting for jobs...");
  while (true) {
    let jobStr = await valkeyBlock.brpoplpush(QUEUE_MAIN, QUEUE_PROCESSING, 0);

    if (!jobStr) {
      LOG.debug("No job found, continuing to wait...");
      continue;
    }

    try {
      const moved = JSON.parse(jobStr);
      if (!moved.startedAt) {
        moved.startedAt = Date.now();
        moved.retries = moved.retries ?? 0;
        const updatedMovedStr = JSON.stringify(moved);
        const initMulti = valkey.multi();
        initMulti.lrem(QUEUE_PROCESSING, 1, jobStr);
        initMulti.lpush(QUEUE_PROCESSING, updatedMovedStr);
        await initMulti.exec();
        jobStr = updatedMovedStr;
      }
    } catch {}
    if (!jobStr) continue;

    try {
      let job = JSON.parse(jobStr);

      const startTime = process.hrtime.bigint();
      const result = await processJob(job);
      const endTime = process.hrtime.bigint();

      job.completedAt = Date.now();
      job.elapsedMs = Number(endTime - startTime) / 1e6;

      const multi = valkey.multi();
      multi.lrem(QUEUE_PROCESSING, 1, jobStr);
      multi.lpush(QUEUE_COMPLETED, JSON.stringify(job));
      await multi.exec();

      LOG.info(
        "Processed:",
        job.id ?? job,
        "result:",
        result,
        "elapsed:",
        job.elapsedMs,
        "ms"
      );
    } catch (err: any) {
      let job;
      try {
        job = JSON.parse(jobStr);
      } catch {
        job = { raw: jobStr };
      }
      job.error = { message: err.message, ts: new Date().toISOString() };
      job.retries = (job.retries ?? 0) + 1;

      const updated = JSON.stringify(job);

      const multi = valkey.multi();
      multi.lrem(QUEUE_PROCESSING, 1, jobStr);
      multi.lpush(QUEUE_ERROR, updated);
      await multi.exec();

      LOG.error("Failed job moved to error queue:", job.id ?? job);
    }
  }
}

process.on("SIGINT", () => safeShutdown([valkey, valkeyBlock], "SIGINT", LOG));
process.on("SIGTERM", () => safeShutdown([valkey, valkeyBlock], "SIGTERM", LOG));
process.on("uncaughtException", (e) => {
  LOG.error("uncaughtException:", e);
  safeShutdown([valkey, valkeyBlock], "uncaughtException", LOG);
});
process.on("unhandledRejection", (e) => {
  LOG.error("unhandledRejection:", e);
  safeShutdown([valkey, valkeyBlock], "unhandledRejection", LOG);
});

run().catch((e) => {
  LOG.error("Worker crashed:", e);
  safeShutdown([valkey, valkeyBlock], "run.catch", LOG);
});
