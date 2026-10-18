---
description: "The on-premises deployment layer: run the Web UI against your own model endpoint with vendor telemetry, accounts, and hosted search switched off, presented as Swiss Harness."
kind: "package-bundle"
---

# @onprem-ai/dsh-onprem-app

English | [中文](README.zh.md)

## Summary

`dsh-onprem-app` is the third patch layer of the `onprem` profile, applied after `dsh-base` and `dsh-web-app`. It turns off every row that would send data to the upstream vendor by default, routes the default model to an OpenAI-compatible endpoint you name through environment variables, pins plugin installation to a registry you choose, and replaces the sidebar and hero brand with Swiss Harness. Start it with `dsh onprem`. The boundary: it decides defaults, not policy. An operator can re-enable any row in the profile's own patch layer.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Point the harness at your model server and start the Web UI; nothing else is required.

### Starting the on-premises profile

```sh
export ONPREM_LLM_BASE_URL=http://vllm.internal:8000/v1
export ONPREM_LLM_MODEL=qwen3-32b
export ONPREM_LLM_API_KEY=…        # omit for an unauthenticated endpoint
dsh onprem
```

The environment describes one provider route named `onprem`:

| Variable | Default | Meaning |
|---|---|---|
| `ONPREM_LLM_BASE_URL` | unset: no route | Endpoint root of the OpenAI-compatible server |
| `ONPREM_LLM_MODEL` | `default` | Model id the endpoint serves; also the default model for new sessions |
| `ONPREM_LLM_API_KEY` | unset: placeholder header | Read through the credential seam per request; the variable name, not its value, enters configuration. Unset, the route sends a fixed `Authorization: Bearer onprem-unauthenticated` header, because the OpenAI-compatible client refuses to send without one; Ollama, vLLM and llama.cpp ignore it |
| `ONPREM_LLM_API` | `openai-completions` | Wire protocol: `openai-completions`, `openai-responses`, or `anthropic-messages` |
| `ONPREM_LLM_CONTEXT` | `131072` | Context window in tokens |
| `ONPREM_LLM_DISPLAY_NAME` | `On-premises model` | Label in the model picker |
| `DSH_PLUGIN_REGISTRY` | unset: pnpm's own | The only npm registry the plugin manager asks |

With `ONPREM_LLM_BASE_URL` unset the profile starts with no model route and the composer shows **Select model** until one is added on the Models settings page, which writes the same `llm-pi-ai` section this layer seeds.

### What leaves the machine

Nothing, by default. The table lists each upstream row that reaches a network endpoint and what this layer does with it:

| Row | Upstream default | Here |
|---|---|---|
| `session-telemetry-otel` | shares a session prefix after explicit feedback, to the vendor collector | disabled |
| `desktop-product-telemetry`, `product-analytics` | desktop usage analytics | disabled |
| `deepseek-account`, `account-controller`, `ui-settings-account`, `llm-deepseek-account` | vendor account sign-in | disabled |
| `deepseek-llm-api-extensions`, `session-log-deepseek`, `plugin-package-inventory-deepseek` | vendor-specific request fields | disabled |
| `llm-deepseek` | direct adapter to the vendor's public API | disabled |
| `web-search-deepseek`, `web-deepseek-api` | hosted search and fetch via the vendor API | disabled; `web` keeps the `http` fetch provider only |
| `message-feedback`, `ui-message-feedback`, `command-feedback` | feedback that releases telemetry | disabled |
| `plugin-manager` | public registry with a mirror fallback | `DSH_PLUGIN_REGISTRY` only, no fallback |
| `web-fetch-http` | upstream User-Agent | `swiss-harness/…` |

The fetch tool stays on because the model fetches whatever URL a task names; which hosts are reachable is the deployment's network policy, not this layer's.

### Re-enabling a row

Every row above is disabled, not removed, so the profile's own layer can turn it back on. For example, to send session telemetry to an internal collector, add to `$DSH_HOME/profiles/onprem/cordis.patch.yml`:

```yaml
- id: session-telemetry-otel
  disabled: false
  config:
    mode: FEEDBACK_ONLY
    exporter:
      url: https://otel.internal/v1/logs
```

The generated [configuration catalog](../../../docs/config-catalog.md) lists every field each row accepts.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package is a patch list and nothing else. `cordis.patch.yml` is applied by the profile composer after the base and web layers, so every `- id:` entry targets a row one of those layers inserted; a target that does not exist is a loader warning, and the bundle test pins that the composition against `dsh-base` plus `dsh-web-app` produces none. The only insert is the brand occupant row. Values that depend on the deployment are `!!js` expressions over `process.env`, evaluated when the row's fiber starts, so one build serves every site.

### Source map

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The deployment patch over base and web-app |
| [`src/index.ts`](src/index.ts) | Empty module; the manifest's `dsh.bundle.patch` field is the substance |
| [`tests/onprem-app.spec.ts`](tests/onprem-app.spec.ts) | No composition warnings, every egress row disabled, route and default model from environment |

### Invariant ownership

No runtime invariant companion is published because the bundle registers nothing and holds no mutable state; the composed rows' packages own their own invariants.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Bundle package map](../README.md) — the surfaces built on the same core.
- [dsh-base](../base/README.md) and [dsh-web-app](../web-app/README.md) — the two layers this one patches.
- [dsh-llm-pi-ai](../../llm/llm-pi-ai/README.md) — the adapter behind the `onprem` route and every further route you add.
- [dsh-client-ui-brand-onprem](../../client/ui-brand-onprem/README.md) — the brand occupant this layer mounts.
- [Upstream sync procedure](../../../MERGING.md) — how this layer survives a new upstream release.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the rows it disables and the route it seeds; each targeted row's package owns the model-facing behaviour.

#### KV Cache effect

None of its own; disabling the vendor request-extension rows removes the `dsh_session_log` and package-inventory fields those rows would otherwise append to each request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These are current constraints of the layer, not a comparison with the upstream defaults.

- **Web profile only** — the `onprem` template stacks on `dsh-web-app`; headless, SDK, and ACP deployments add this bundle to their own profile manifest until matching templates exist.
- **Desktop packaging still carries the upstream name** — the Electron product name, installer strings, and update origin are outside this layer.
- **No search provider is mounted** — a web search call fails until the operator mounts one and names it in the `web` row.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This bundle is onprem.ai's overlay, not upstream code. When an upstream release adds a row that reaches the network, add it here and to the egress list in the test in the same change.

</details>
