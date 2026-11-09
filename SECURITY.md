# Security

## Supported versions

| Version | Supported |
| --- | --- |
| 0.3.x | Yes |
| < 0.3 | No |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Use GitHub's private
vulnerability reporting for this repository (Security → Report a vulnerability), or contact
the maintainers through the repository's private security advisory channel.

Include:

- affected version and Node version;
- a minimal reproduction with synthetic data;
- impact and any suggested fix;
- whether the issue involves the model adapter, persisted state, or prompt handling.

We aim to acknowledge reports within a few days and will coordinate disclosure after a fix is
available. This is a small volunteer project; no bounty program is implied.

## Data handling

- The core performs **no network requests** and has no telemetry.
- With `stateDir`, state is written unencrypted to `memory-state.json`. Creation requests
  POSIX `0600` for files and `0700` for directories; it does not tighten existing directory
  permissions. Windows ACLs must be configured by the host ([Node filesystem documentation](https://nodejs.org/api/fs.html#file-modes)).
- Fading filters recall views; original evidence remains stored until withdrawal. It is not
  data deletion or encryption.
- The state contains selected memory text, private thoughts, expression candidates, and
  run metadata. Treat it as private user data.
- `stateDir` must be a real directory; a state directory that is itself a symlink/junction is
  rejected. Parent directories may be managed by the host.
- The host-provided model adapter receives the selected memory text and persona. The host is
  responsible for provider data handling, retention, and user consent.
- Prompts treat remembered instructions and persona text as data, not authority. Prompt
  injection remains a host/model concern; do not feed untrusted instructions as system text.

## Operational notes

- Do not commit `memory-state.json`, `.env`, API keys, or real chat logs.
- Error messages are redacted for `sk-...`-style secrets before being written to run records.
- Current source serializes writer-lock creation/reclamation with a guard, refuses unknown
  lock owners, and retains taken/unknown delivery bookkeeping after source changes.
- Historical public v0.3.0 lacks these fixes. See the [release-era record](docs/archive/verification-2026-11-07.md).
- The evaluation runners contact a configured provider only in live mode. Generated
  prompts, replies and runtime state are excluded from Git and npm packages. Review
  synthetic inputs before sharing them; a synthetic label is not a privacy detector.

## Unreleased source protections

External readers never initialize or migrate source stores. Use an OS-restricted reader identity for a hard read-only boundary. Global derived state is separate; source references and audience permissions are revalidated before use. Unknown write-lock owners are not reclaimed; a leftover guard requires manual recovery after verifying all writers have stopped. Taken/unknown delivery records retain bookkeeping but lose withdrawn text. See docs/read-only-sources.md.
