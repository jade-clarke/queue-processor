Queue Processor — monorepo

Short summary

Lightweight Node monorepo that implements a small queue-processing system: worker(s) process jobs, reaper detects stale jobs, cleaner maintains queues. Shared utilities live in `packages/utils` and types in `packages/types`.

Workspace layout

- packages/
  - types/        shared TS types
  - utils/        shared utilities (valkey, logger, uuid)
- services/
  - cleaner/      cleaner service
  - reaper/       reaper service
  - worker/       worker service

Quickstart (local)

Install deps:

```bash
pnpm i
```

Build a single service (e.g. worker):

```bash
pnpm run build:worker
```

Build all services:

```bash
pnpm run build:all
```

Run a built service (example: worker):

```bash
node services/worker/dist/index.js
```

Lint & typecheck

```bash
pnpm run lint
pnpm run typecheck
```

Docker

The repository includes a multi-stage Dockerfile that builds a single service. Example (from repo root):

```bash
# Build an image for the worker service
docker build --build-arg TARGET_SVC=worker --build-arg NODE_ENV=production -t queue-processor-worker .

# Run the image
docker run --rm queue-processor-worker
```