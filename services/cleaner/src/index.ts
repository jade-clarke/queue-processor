import { initLogger } from "@utils/logger";
import { safeShutdown, ValKey } from "@utils/valkey";

const LOG = initLogger("cleaner");

const host = process.env.KV_HOST || "valkey";
const port = Number(process.env.KV_PORT || 6379);

const COMPLETED = process.env.QUEUE_COMPLETED || "q:completed";

const MAX_PRESERVED_JOBS = Number(process.env.MAX_PRESERVED_JOBS ?? 1000);
const EXPIRED_AFTER_MS = Number(process.env.EXPIRED_AFTER_MS ?? -1);
const SCAN_INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS ?? 60_000);

const valkey = new ValKey({ host, port });

async function capByMax() {
  if (MAX_PRESERVED_JOBS < 0) return;
  await valkey.ltrim(COMPLETED, 0, MAX_PRESERVED_JOBS - 1);
}

async function expireByAge() {
  if (EXPIRED_AFTER_MS < 0) return 0;

  const now = Date.now();
  let removed = 0;
  let len = await valkey.llen(COMPLETED);

  while (len > 0) {
    if (MAX_PRESERVED_JOBS >= 0 && len <= MAX_PRESERVED_JOBS) break;

    const tail = await valkey.lindex(COMPLETED, -1);
    if (!tail) break;

    try {
      const job = JSON.parse(tail);
      const completedAt = Number(job?.completedAt ?? job?.completed ?? 0);
      if (!Number.isFinite(completedAt)) break;
      const age = now - completedAt;
      if (age > EXPIRED_AFTER_MS) {
        await valkey.rpop(COMPLETED);
        removed += 1;
        len -= 1;
        continue;
      }
      break;
    } catch {
      break;
    }
  }

  return removed;
}

async function sweepOnce() {
  await capByMax();
  const expired = await expireByAge();
  return { expired };
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

let sweeping = false;
setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    const { expired } = await sweepOnce();
    if (expired > 0) {
      LOG.info(`sweep: expired=${expired}`);
    }
  } catch (err) {
    LOG.error("sweep error:", err);
  } finally {
    sweeping = false;
  }
}, SCAN_INTERVAL_MS);

LOG.info("started; ", {
  MAX_PRESERVED_JOBS,
  EXPIRED_AFTER_MS,
  SCAN_INTERVAL_MS,
});
