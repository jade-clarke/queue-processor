import { safeShutdown, ValKey } from "../packages/utils/src/valkey";
import { uuid } from "../packages/utils/src/uuid";
import type { Job } from "../packages/types/src/index";

const host = process.env.KV_HOST || "127.0.0.1";
const port = Number(process.env.KV_PORT || 6379);
const QUEUE_MAIN = process.env.QUEUE_MAIN || "q:main";

const valkey = new ValKey({ host, port });

const entries = parseInt(process.argv.slice(2)[0], 10) || 1000;

async function main() {
  let samples: Job[] = [];

  for (let i = 1; i <= entries; i++) {
    let jobId = `${uuid()}`;
    if (Math.random() < 0.05) {
      samples.push({
        id: `${jobId}`,
        payload: {
          task: "fail-task",
          shouldFail: true,
          failMessage: "test failure",
        },
      });
      continue;
    }
    samples.push({
      id: `${jobId}`,
      payload: { task: "example-task", args: { count: i } },
    });
  }

  for (const job of samples) {
    await valkey.lpush(QUEUE_MAIN, JSON.stringify(job));
    console.log("Enqueued:", job.id);
  }

  safeShutdown([valkey], "Enqueue completed, shutting down...", console.log);
}

main();
