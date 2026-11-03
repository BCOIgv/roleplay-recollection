# roleplay-recollection-dsh

DSH Bundle for [`roleplay-recollection`](../README.md). It registers the core recollection engine as Agent-callable tools, so DSH can capture experiences, look up visible memories, revise or withdraw them, and manage expression candidates.

> Chinese name: 朝花夕拾. Core package: `roleplay-recollection`.

## Install

### Local development

Install the `dsh/` directory as a DSH Bundle with the plugin manager (target: this directory). For local testing before the core package is on npm, install the core tarball first:

```bash
cd dsh
npm install ../dist/roleplay-recollection-0.3.0.tgz --no-save
```

The bundle patch inserts one row:

```yaml
id: roleplay-recollection
name: roleplay-recollection-dsh
config:
  characterId: default
  scopeId: default
  mode: companion
  stateDir: !!js dshHomePath('roleplay-recollection')
```

### From npm

After publishing the core package, publish this package from `dsh/`:

```bash
cd dsh
npm install
npm publish --access public
```

Then install `roleplay-recollection-dsh` as a DSH Bundle in the plugin manager. The package declares `dsh.bundle.patch`, so it is a configuration-only bundle plus one Host plugin row.

## Config

| Key | Default | Meaning |
| --- | --- | --- |
| `characterId` | `default` | Character identity; memories are isolated by it |
| `scopeId` | `default` | Conversation scope (private/group/story) |
| `mode` | `companion` | `companion` or `roleplay` |
| `storyId` | — | Required when `mode: roleplay` |
| `persona` | — | Optional character voice text; treated as data, not instructions |
| `stateDir` | `dshHomePath('roleplay-recollection')` | Persistent state directory |

Other core settings (`dailyModelCalls`, `maxEpisodes`, `solitudeIntervalHours`, etc.) can be placed in the same config object; they are passed to `CompanionMemory`.

## Tools

| Tool | Purpose |
| --- | --- |
| `roleplay_recollection_status` | Status, budgets, next solitude, pending candidates |
| `roleplay_recollection_capture` | Store one source-backed experience |
| `roleplay_recollection_visible` | Return visible memories for an existing reply; zero model calls |
| `roleplay_recollection_private_thoughts` | Return still-valid tentative thoughts |
| `roleplay_recollection_recollect` | Cue recollection; without a model adapter returns the top visible memory |
| `roleplay_recollection_revise` | Revise an experience by current revision |
| `roleplay_recollection_forget` | Withdraw an experience and derived content |
| `roleplay_recollection_set_source_available` | Mark source availability |
| `roleplay_recollection_pause` | Pause/resume optional memory work |
| `roleplay_recollection_take_expression` | Take a candidate; it is still not sent |
| `roleplay_recollection_settle_expression` | Reconcile a contact candidate with a real receipt |

## Current limits

- **No model adapter in this bundle**: `roleplay_recollection_recollect` returns a visible memory but cannot produce a private thought or expression; `solitude()` is not exposed as a tool because it needs a host `wander` adapter.
- The core's zero-model `visible()` path is fully usable; host LLM can use it as the memory layer for normal replies.
- Expression candidates are never sent by this plugin; the host must deliver and call `roleplay_recollection_settle_expression`.
- AstrBot is intentionally not included in this package; it is a Python plugin system.

## Layout

```text
dsh/
  package.json          # dsh.bundle.patch + core dependency
  cordis.patch.yml      # inserts the roleplay-recollection row
  index.js              # export apply(ctx, config) + inject ['tools']
  locale/en.json        # plugin manager display metadata
  locale/zh.json
  icon.svg
```

## Publish order

1. Publish `roleplay-recollection` from the repository root.
2. `cd dsh && npm install && npm publish --access public`.
3. Verify the package tarball includes `index.js`, `cordis.patch.yml`, `locale/*.json`, `icon.svg`.
