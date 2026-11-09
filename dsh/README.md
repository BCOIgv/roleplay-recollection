# roleplay-recollection-dsh · Character recollection tools for DSH

**Roleplay Recollection · 朝花夕拾**

Idle recollection, mind-wandering, and optional outreach for AI characters.

DSH bundle for [Roleplay Recollection · 朝花夕拾](../README.en.md), an idle recollection and optional expression layer for AI characters. The core package is a separate dependency. Model-backed solitude uses global mode with host services; local mode exposes the episode tools described below. Use **Node.js ≥ 22.16** for current source.

[中文项目说明](../README.md) · [Core quick start](../README.en.md#quick-start) · [Global integration guide](../docs/read-only-sources.md)

Current behavior, proposed budget/termination changes, and unvalidated experience claims
are tracked separately in the [boundary review](../docs/wandering-boundaries.md) and
[staged evaluation plan](../docs/evaluation-plan.md). This documentation does not change
runtime limits or enable real-model experiments.

## Choose a mode and version

| Mode | Available in | Tools and host requirements |
| --- | --- | --- |
| Local | Public v0.3.0 and current source | 11 tools for one configured character and scope; host routes callers and controls access |
| Global | Current source only | 9 tools for read-only sources, recall, and solitude; host supplies trusted identity, authorization, and optional model hooks |

Current source enables global mode when `sources` is configured or the host provides `ctx.recollection.listMemorySources()`. Otherwise it uses local mode. A sources array alone is insufficient: global mode also requires the trusted services described below.

The timeline evaluation host explicitly injects thoughts and anchored source text into replies. This is not installed as a default DSH reply hook. Real DSH service bridging and production delivery still need separate validation. Installed tarball and mock-host checks are documented in [verification notes](../docs/verification.md).

## Install both packages

### Current source

From the cloned repository root, build the core and bundle into a separate directory:

```bash
npm ci
node --input-type=module -e "import {mkdirSync} from 'node:fs'; mkdirSync('dist/current-source', {recursive: true})"
npm pack --pack-destination ./dist/current-source
npm pack ./dsh --pack-destination ./dist/current-source
```

`npm pack` runs the core verification hook. Both locally built files currently retain version `0.3.0`; their contents include unreleased source changes. Keep them separate from downloaded public release files, and install the matching pair together.

Copy both tarballs to the package directory used by your DSH host, then run the following **in that host package environment**:

```bash
npm install ./roleplay-recollection-0.3.0.tgz ./roleplay-recollection-dsh-0.3.0.tgz
```

Load the bundle using your host's plugin loader. The package declares `dsh.bundle.patch: ./cordis.patch.yml`; registration behavior depends on that host. Source packaging and installation do not establish real-host compatibility.

### Public v0.3.0

For the earlier local-mode release, run this in the package environment used by your DSH host:

```bash
npm install https://github.com/BCOIgv/roleplay-recollection/releases/download/v0.3.0/roleplay-recollection-0.3.0.tgz https://github.com/BCOIgv/roleplay-recollection/releases/download/v0.3.0/roleplay-recollection-dsh-0.3.0.tgz
```

Both packages are provided as [Release assets](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0), with SHA-256 checksum files. Package-name-only registry installation is not currently a supported entry point. Installing only the DSH tarball leaves its core dependency unresolved when the core is unavailable from the registry.

Public v0.3.0 has known limitations and lacks the global APIs and current fixes. Its bundle declares MIT but omits the license text; include the repository's [LICENSE](../LICENSE) when redistributing that historical bundle independently. Current source includes the license.

## Configure local mode

The configuration patch inserts this plugin row:

```yaml
id: roleplay-recollection
name: roleplay-recollection-dsh
config:
  characterId: default
  scopeId: default
  mode: companion
  stateDir: !!js dshHomePath('roleplay-recollection')
```

The `!!js` value is a DSH patch expression interpreted by the host. When calling `apply()` directly, supply an actual filesystem path as `stateDir`.

| Key | Set it to |
| --- | --- |
| `characterId` | A stable character ID |
| `scopeId` | A stable private-chat, group, or story scope |
| `mode` | Explicitly use `companion` or `roleplay`; public v0.3.0 requires this to avoid its default-mode bug |
| `storyId` | Required for roleplay; omit for companion |
| `persona` | Optional character voice data |
| `stateDir` | A distinct persistent directory for this instance; omission in direct `apply()` uses memory only |

The local bundle uses its configured scope for every caller. The host must route sessions and restrict tool access. Assign separate instances and persistent directories to separate scopes. Other core settings are forwarded to `CompanionMemory`; see the [API reference](../docs/api.md).

## Configure global mode

Register read-only sources through `config.sources` or `ctx.recollection.listMemorySources()`, and provide a separate runtime `stateDir`. Source directories and runtime directories must not contain one another.

The trusted `ctx.recollection` service contract is:

| Service | Purpose |
| --- | --- |
| `resolveAccess(exec)` | Verify the caller and audience from host execution context |
| `authorize(request)` | Explicitly approve tool, source, and material access |
| `contextKey(access)` | Provide a stable identity and audience key |
| `listMemorySources()` | Optional host registry of approved sources; replaces a manual sources array |
| `setupModel` | Optional mapping helper for ambiguous source schemas |
| `reflect` / `wander` | Optional real model executors; process `request.signal` and return parsed `{value: ...}` |

Missing required identity or authorization services cause initialization to fail. See the [global integration guide](../docs/read-only-sources.md) for source mappings, permissions, runtime examples, and delivery settlement.

## Tool reference

All tool names start with `roleplay_recollection_`.

| Local suffix | Purpose |
| --- | --- |
| `status` | Inspect memory counts, budgets, and pending candidates |
| `capture` | Store a structured episode with evidence |
| `visible` | Retrieve visible memories without a model call |
| `private_thoughts` | Read still-valid tentative thoughts |
| `recollect` | Cue lookup; local bundle has no model reflection hook |
| `revise` | Replace an episode using its current revision |
| `forget` | Withdraw an episode and derived content |
| `set_source_available` | Update source availability |
| `pause` | Pause or resume optional memory work |
| `take_expression` | Take an existing candidate without sending it |
| `settle_expression` | Reconcile solitude contact with a host-supplied receipt |

Global mode registers `status`, `global_search`, `visible`, `recollect`, `solitude`, `private_thoughts`, `take_expression`, `settle_expression`, and `pause`. Source edits remain the responsibility of the original memory system.

The local bundle supplies neither a model executor nor a solitude tool, so installing it alone does not generate thoughts or expressions. Global mode can use host model services. Both modes return candidates for the host to use; actual sending and truthful delivery receipts remain host responsibilities.
