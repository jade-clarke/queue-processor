export type Job = {
  id: string;
  payload: any;
  retries?: number;
  elapsedMs?: number;
  error?: {
    message: string;
    ts: string;
  };
}