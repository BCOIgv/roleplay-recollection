> Current source adds global mode when `sources` is configured or the trusted host provides `ctx.recollection.listMemorySources()`. It initializes mappings and registers 9 global tools, with host-provided identity, authorization and model services. See [the global integration guide](https://github.com/BCOIgv/roleplay-recollection/blob/main/docs/read-only-sources.md). Node >=22.16 is required. Published v0.3.0 and the legacy mode below do not include this integration.

# roleplay-recollection-dsh

DSH Bundle for [AI Roleplay Recollection · 朝花夕拾](https://github.com/BCOIgv/roleplay-recollection). It registers 11 Agent-callable tools for one configured character and scope. It depends on `roleplay-recollection@^0.3.0` and requires Node.js ≥ 22.

## Install

As of 2026-11-04, neither package is available in the public npm registry. Download both tarballs and checksum files from [Release v0.3.0](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0), verify SHA-256, then install both into the package environment used by the DSH host:

```bash
npm install ./roleplay-recollection-0.3.0.tgz ./roleplay-recollection-dsh-0.3.0.tgz
```

Installing the DSH tarball alone still requires a resolvable core dependency. For source development, install the downloaded core tarball in `dsh/`, then point the plugin manager at that directory. Actual DSH installation and runtime compatibility have not yet been verified; the tested mock host is not a substitute.

After registry publication is confirmed, the plugin manager can resolve `roleplay-recollection-dsh` by package name. Maintainer release instructions are in the [release checklist](https://github.com/BCOIgv/roleplay-recollection/blob/main/docs/releasing.md).

## Configuration

The `dsh.bundle.patch` entry points to `cordis.patch.yml`, which inserts a Host plugin row:

```yaml
id: roleplay-recollection
name: roleplay-recollection-dsh
config:
  characterId: default
  scopeId: default
  mode: companion
  stateDir: !!js dshHomePath('roleplay-recollection')
```

| Key | Configuration |
| --- | --- |
| `characterId` | Set a stable character ID; constructor fallback is `default` |
| `scopeId` | Set a stable private/group/story scope; constructor fallback is `default` |
| `mode` | Explicitly set `companion` or `roleplay`; 0.3.0 tool contexts fail if this is omitted |
| `storyId` | Required for roleplay; omit for companion |
| `persona` | Optional character voice data |
| `stateDir` | Patch sets the path above; direct `apply()` without it uses memory only |

Other core settings are forwarded to `CompanionMemory`; see the [API reference](https://github.com/BCOIgv/roleplay-recollection/blob/main/docs/api.md).

The bundle does not derive identity or scope from the caller. Every tool on an instance uses that instance's configured scope. The host must route sessions, restrict tool access, and assign distinct persistent directories. The default row is not automatic multi-chat isolation.

## Tools

All names start with `roleplay_recollection_`.

| Suffix | Purpose |
| --- | --- |
| `status` | Inspect counts, budgets, and pending candidates |
| `capture` | Store a structured source-backed episode |
| `visible` | Query visible memories without a model call |
| `private_thoughts` | Return still-valid tentative thoughts |
| `recollect` | Cue lookup; currently returns a visible memory without model reflection |
| `revise` | Replace episode content using its current revision |
| `forget` | Withdraw an episode and derived content |
| `set_source_available` | Set source availability |
| `pause` | Pause or resume optional memory work |
| `take_expression` | Take an existing candidate without sending it |
| `settle_expression` | Reconcile solitude contact with a host-supplied receipt |

## Limits

- No model adapter or solitude tool is included. This bundle alone does not generate private thoughts or expression candidates.
- Source authenticity and delivery receipts are supplied by the host; the core checks their structure, not external truth.
- Real DSH schema compatibility, lifecycle behavior, and platform delivery remain unverified.
- The published 0.3.0 DSH tarball declares MIT but omits the license text. Include the repository's LICENSE in the next bundle artifact before redistributing it independently.

The bundle contains `index.js`, the configuration patch, locale metadata, and an icon. The core is a separate dependency, not bundled source.
