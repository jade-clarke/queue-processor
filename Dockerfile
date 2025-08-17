FROM node:22-alpine AS builder

ARG TARGET_SVC
RUN test -n "${TARGET_SVC}" || (echo "TARGET_SVC is required" >&2; exit 1)

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@latest --activate

COPY \
  package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml \
  tsconfig.base.json \
  ./

COPY services/ ./services/
COPY packages/ ./packages/

RUN pnpm i --frozen-lockfile

RUN pnpm run build:${TARGET_SVC}

FROM node:22-alpine AS runner

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}
RUN test -n "${NODE_ENV}" || (echo "NODE_ENV is required" >&2; exit 1)

ARG TARGET_SVC
ENV TARGET_SVC=${TARGET_SVC}

WORKDIR /app

COPY --from=builder /app/services/${TARGET_SVC}/dist/ ./
COPY --from=builder /app/services/${TARGET_SVC}/package.json ./

CMD ["node", "index.js"]