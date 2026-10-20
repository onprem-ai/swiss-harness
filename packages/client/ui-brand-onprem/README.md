---
description: "Swiss Harness brand occupants for the sidebar and conversation hero, active in every client build; for maintainers choosing or replacing brand presentation."
kind: "package-reference"
---

# @onprem-ai/dsh-client-ui-brand-onprem

English | [中文](README.zh.md)

## Summary

This package gives the Web client the Swiss Harness mark and name in the sidebar and the same mark in the conversation hero. Unlike the upstream official brand package it registers in every client build, so the deployment's identity does not depend on a build-time profile. Choose it through the `onprem` profile, which mounts it in place of the official occupants. It has no runtime state and does not affect model requests.

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

Mount this plugin in the browser roster of a deployment presented as Swiss Harness; the `onprem-app` bundle does so and disables the upstream `ui-brand-official` row in the same layer.

### Replacing the brand

Another identity leaves this package out and composes a package that occupies the same three slots: `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark`. Occupying a slot is the only composition route; there is no brand configuration surface here. The browser title is a build-environment concern (`DSH_CLIENT_TITLE`), outside the slot system.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The sidebar occupants install as one declaration-aware registration set: nested `ctx.slots.inject()` calls wait on the sidebar declaration, so the set works whether this row activates before or after the declarer and withdraws both occupants when the declaration collapses. The hero occupant is a second set over the conversation declaration. The mark is one inline SVG of the Swiss-flag cross in monochrome (1-unit corner radius): the square uses the brand-primary token and the cross the base background token, so it is black with a white cross on the light theme and white with a black cross on the dark theme, with no asset pipeline. The browser half is [`src/client/index.ts`](src/client/index.ts); the node half is an empty Loader seat.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-sidebar](../ui-sidebar/README.md) — declares `sidebar.brand.mark` and `sidebar.brand.name` and renders their fallbacks.
- [ui-conversation](../ui-conversation/README.md) — declares `conversation.hero.brand.mark` in the hero.
- [ui-brand-official](../ui-brand-official/README.md) — the upstream occupant this package replaces.
- [dsh-onprem-app](../../bundle/onprem-app/README.md) — the bundle that mounts this package.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define how brand presentation is supplied. They are current package constraints, not a brand-design comparison.

- **One occupant set** — alternative presentation belongs in another Cordis package occupying the same slots.
- **The browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot.
- **Placeholder mark** — the cross-in-square mark stands in until onprem.ai supplies final artwork; swap the SVG in `Brand.tsx`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This package is onprem.ai's overlay, not upstream code. It mirrors `ui-brand-official` so an upstream change to the slot contract shows up as the same compile error in both.

</details>

**Runtime invariant:** No companion is published. The package retains no mutable state, and its slot occupants install and leave through transactional effects.
