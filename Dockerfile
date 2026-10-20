# syntax=docker/dockerfile:1.7
# Swiss Harness Web GUI image; the `onprem` profile reads ONPREM_LLM_* and DSH_WEB_AUTH (docker/README.md).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential musl-tools python3 \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /src
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
# The build context excludes .git, so the client's commit metadata arrives as a build argument.
ARG DSH_CLIENT_COMMIT_HASH=0000000
ENV DSH_CLIENT_COMMIT_HASH=${DSH_CLIENT_COMMIT_HASH}
RUN pnpm run build:artifacts
# build:artifacts builds only the host flock addon; the sandbox's Landlock runner needs the static launcher too.
RUN pnpm exec tsx native/system/scripts/build.ts

# Production closure of the `dsh` CLI only: no dev tooling, Desktop, tests, or sources.
# Workspace peers are not dependencies of the CLI manifest, so peers are installed into the hoisted tree.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter @onprem-ai/dsh deploy --prod --legacy \
      --config.allow-unused-patches=true \
      --config.auto-install-peers=true \
      --config.node-linker=hoisted \
      --config.link-workspace-packages=true \
      /app \
 && pnpm exec tsx docker/stage.ts /app /src \
 && sh docker/prune.sh /app

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates procps tini \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o node -g node /home/node/.dsh /workspace
COPY --from=build --chown=node:node /app /app
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/dsh-entrypoint
USER node
ENV DSH_HOME=/home/node/.dsh \
    NODE_ENV=production
WORKDIR /workspace
VOLUME ["/home/node/.dsh", "/workspace"]
EXPOSE 3080
ENTRYPOINT ["/usr/bin/tini", "--", "dsh-entrypoint"]
CMD ["serve"]
