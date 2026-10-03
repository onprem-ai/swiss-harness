# Security review: upstream dsh-v0.2.0-rc.2

Status: **in progress**. The network egress section is complete and drives the `dsh-onprem-app` overlay. Supply chain, execution surface and artefact sections are still open.

Upstream tag `dsh-v0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84`, released 2026-09-29. Review started 2026-10-03.

## Network egress

Method: every `http(s)://` and `ws(s)://` literal in `packages/`, `apps/`, `vendor/`, `python/` and `native/`, excluding tests, fixtures, documentation and locale files, grouped by hostname and traced to the row or code path that reaches it. Verdicts refer to the `onprem` profile (`dsh-base` + `dsh-web-app` + `dsh-onprem-app`).

### Endpoints reached by default upstream

| Host | Reached by | Trigger upstream | Data | Verdict |
| --- | --- | --- | --- | --- |
| `dsh-otel-collector.deepseeksvc.com` | `packages/bundle/base/cordis.patch.yml:211` row `session-telemetry-otel`; `packages/host/product-telemetry-otel/src/index.ts:47` | Session prefix released after a user clicks Like or Dislike (mode `FEEDBACK_ONLY`); desktop product analytics on every interaction | Session content (prompts, responses, tool calls) up to 4 MB per request, plus the anonymous user id from `$DSH_HOME/.anonymous-user-id`; desktop: device id, account id, OS and app version, model and effort switches, message submission events | mitigated in overlay: rows `session-telemetry-otel`, `desktop-product-telemetry`, `product-analytics`, `message-feedback`, `ui-message-feedback`, `command-feedback` disabled |
| `api.deepseek.com` | `packages/llm/llm-deepseek/src/config.ts:106` (default base URL of the direct adapter); `packages/web/web-search-deepseek/src/provider.ts:34`; `packages/credentials/deepseek-account-platform/src/index.ts:56` | Every model request when the default provider `deepseek-official` is selected (`packages/bundle/base/cordis.patch.yml:85`); every web search; account token exchange | Full prompt and conversation; search queries; account credentials | mitigated in overlay: rows `llm-deepseek`, `llm-deepseek-account`, `web-search-deepseek`, `deepseek-account` disabled; default provider replaced by the `onprem` route |
| `platform.deepseek.com` | `packages/credentials/deepseek-account-platform/src/index.ts:53` | Account sign-in (PKCE), usage and top-up pages | Account identity | mitigated in overlay: `deepseek-account`, `account-controller`, `ui-settings-account` disabled |
| `registry.npmjs.org`, `registry.npmmirror.com` | `packages/boot/plugin-manager/src/registry.ts:14,17` (install with mirror fallback); `packages/client/ui-plugin-manager/src/index.ts:62` (reachability ping) | Plugin install from the Plugins page or `dsh plugin add`; the ping runs when the Plugins page opens | Package names; the ping sends nothing but reveals the client to both registries | partly mitigated: `plugin-manager` pinned to `DSH_PLUGIN_REGISTRY` with no fallback. **Open:** the Plugins page ping to both public registries is hardcoded in the UI plugin and not configurable; disable `ui-plugin-manager` in the profile layer for air-gapped sites, or patch upstream |
| `download.deepseek.com`, `download-test.deepseek.com` | `apps/desktop/scripts/desktop-auto-update-environment.mjs:18`, `apps/desktop/src/update-coordinator.ts` (electron-updater) | Desktop app start; `DSH_DESKTOP_MANDATORY_UPDATE_CONFIG` can make an update mandatory | Current version | **open**: desktop packaging is outside the overlay. Not a concern for the Web profile; must be addressed before a desktop build ships |

### Vendor-specific request fields

`deepseek-llm-api-extensions`, `session-log-deepseek` and `plugin-package-inventory-deepseek` append top-level fields (`dsh_session_log`, package inventory) to requests sent to the official DeepSeek API. They reach no other endpoint but would ship session history and the installed plugin list to the vendor on every request. Verdict: mitigated in overlay, all three rows disabled.

### Endpoints reached only on explicit opt-in

| Host | Reached by | Verdict |
| --- | --- | --- |
| `api.exa.ai`, `api.perplexity.ai` | `packages/web/web-search-exa`, `web-search-perplexity`; not mounted by any shipped bundle | ok: opt-in via profile layer with the operator's own key |
| `huggingface.co`, `hf-mirror.com` | `packages/experimental/speech-to-text-sensevoice/src/config.ts:62`; downloads speech models at first use | ok: experimental optional bundle, not in the default roster; air-gapped sites must not enable voice input |
| `trtgsjkv6r.feishu.cn` | `packages/client/ui-settings-account/src/contact-config.ts:17`, contact form link in Account settings | mitigated: `ui-settings-account` disabled |
| GitHub, PyPI, npm, Stack Overflow, MDN and similar | `packages/client/ui-primitives/src/SiteGlyph.tsx` (icon lookup table for rendered links), documentation links | ok: no request is made by code; these are link decorations and doc URLs |

### Fetch tool

`web-fetch-http` is kept on. The model fetches whatever URL a task names, so reachability is the deployment's network policy. The default `User-Agent` named the upstream project and its GitHub organisation (`packages/web/web-fetch-http/src/index.ts:23`); the overlay sets it to `swiss-harness/…`.

### Default provider

Upstream default is `deepseek-official` / `deepseek-flash` at `https://api.deepseek.com/anthropic` (`packages/bundle/base/cordis.patch.yml:85`, `packages/llm/llm-deepseek/src/config.ts:106`). The overlay sets the default to provider `onprem`, an `llm-pi-ai` route whose base URL, model, protocol and credential reference come from `ONPREM_LLM_*` environment variables. With `ONPREM_LLM_BASE_URL` unset the profile has no route at all and the UI blocks input until one is configured. Verdict: mitigated in overlay.

### Runtime package installation

Yes, by design: the plugin manager runs pnpm inside the profile directory to install plugin bundles from a registry (`packages/boot/plugin-manager`). Upstream asks the configured registry, then falls back to `registry.npmmirror.com`. The overlay pins the registry to `DSH_PLUGIN_REGISTRY` and empties the fallback list, so an unset variable leaves pnpm's own configuration and nothing else. Air-gapped sites point `DSH_PLUGIN_REGISTRY` at an internal mirror or disable `plugin-manager` and `ui-plugin-manager`.

### Python SDK

`python/sdk` installs `deepseek-harness-runtime-bin`, a wheel that bundles a prebuilt `dsh` executable (`python/sdk-runtime/hatch_build.py`). No download happens at runtime beyond the PyPI install itself. Verdict: **open** under supply chain, since the wheel is a prebuilt binary we do not yet build ourselves.

## Supply chain

Not started. Known inputs: `pnpm-workspace.yaml` `allowBuilds` lists `esbuild`, `lefthook`, `node-pty`, `koffi`, and the workspace's own `subprocess-local` postinstall; seven `patches/` entries; registry-sourced `@deepseek-ai/libreoffice-kit*` prebuilt LibreOffice binaries per platform; `native/system` Landlock addon built from `src/main.c` and `src/flock.c`.

## Code execution surface

Not started.

## Artefacts

Not started.

## Sign-off

Not signed off. Open items so far: desktop update origin, Plugins page registry ping, Python runtime wheel provenance.
