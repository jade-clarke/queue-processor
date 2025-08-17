import type ValKey from "iovalkey";
export { default as ValKey } from "iovalkey";

export async function safeClose(client: ValKey | null, logger: any) {
  if (!client) return;
  try {
    if (typeof client.quit === "function") {
      await client.quit();
    } else if (typeof client.disconnect === "function") {
      client.disconnect();
    }
  } catch (e) {
    logger.error("error during client close:", e);
  }
}

let shuttingDown = false;
export async function safeShutdown(clients: ValKey[], reason: string, logger: any) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    logger.info(`shutting down (${reason})...`);
    await Promise.allSettled(clients.map((client) => safeClose(client, logger)));
  } catch (e) {
    logger.error("error during shutdown:", e);
   } finally {
    process.exit(0);
  }
}