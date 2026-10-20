# Container image

The image serves the Swiss Harness Web GUI with the `onprem` profile ([onprem-app](../packages/bundle/onprem-app/README.md)). CI publishes it to `ghcr.io/onprem-ai/swiss-harness` from `main` and `swiss-harness-v*` tags through [container-publish.yml](../.github/workflows/container-publish.yml).

## Run

```sh
docker run -d --name swiss-harness -p 127.0.0.1:3080:3080 \
  -e ONPREM_LLM_BASE_URL=http://vllm.internal:8000/v1 \
  -e ONPREM_LLM_MODEL=qwen3-32b \
  -v swiss-harness-home:/home/node/.dsh \
  -v "$PWD":/workspace \
  ghcr.io/onprem-ai/swiss-harness:latest
docker logs swiss-harness   # prints the dsh web: URL, with ?token= unless DSH_WEB_AUTH=trusted-proxy
```

The container binds its own address (`hostname -i`), because the server rejects wildcard binds. Publish the port only to the proxy or loopback.

| Variable | Default | Meaning |
|---|---|---|
| `ONPREM_LLM_*`, `DSH_PLUGIN_REGISTRY` | see [onprem-app](../packages/bundle/onprem-app/README.md#use-this-package) | Model route and plugin registry |
| `DSH_WEB_AUTH` | `launch-token` | `trusted-proxy` drops the `?token=` URL; set it only when an authenticating reverse proxy is the sole network path to the port |
| `DSH_PUBLIC_URL` | unset | Advertised root behind a proxy, passed as `--public-url` |
| `DSH_TRUSTED_HOSTS` | unset | Space-separated browser-visible authorities, each passed as `--trusted-host`; required for the proxy's host name |
| `DSH_WEB_PORT` | `3080` | Listen port |
| `DSH_WEB_HOST` | first `hostname -i` address | Bind address |
| `DSH_PROFILE` | `onprem` | Profile to boot |

`/home/node/.dsh` holds profiles, sessions, settings, and the cookie signing secret; `/workspace` is the default workspace. Any first argument other than `serve` runs `dsh` directly, for example `docker run --rm <image> --version`.

## Behind an authenticating proxy

With `DSH_WEB_AUTH=trusted-proxy`, every request that reaches the listener acts as the owner, so the proxy must be the only route to the port and must authenticate every path, including `/api` and WebSocket upgrades. Forward the original `Host` header (or list the proxy's upstream host in `DSH_TRUSTED_HOSTS`), and set `DSH_PUBLIC_URL` to the external root. The Host/Origin check still rejects other authorities.

## Sandbox

Commands run under the Landlock launcher built into the image, which needs a Linux 5.13+ host kernel and works under Docker's default seccomp profile. The image omits `bubblewrap`, which cannot create namespaces in an unprivileged container.

## Contents

The runtime stage holds only the `pnpm deploy --prod` closure of the `dsh` CLI ([stage.ts](stage.ts) replaces workspace links with files; [prune.sh](prune.sh) drops other platforms' native binaries, type declarations, source maps, and package docs), plus Node, `git`, and `tini`. The largest remaining dependency is the LibreOffice WebAssembly engine (about 146 MB) that Office document preview and conversion use.

## Build locally

```sh
docker build --build-arg DSH_CLIENT_COMMIT_HASH=$(git rev-parse HEAD) -t swiss-harness:local .
```
