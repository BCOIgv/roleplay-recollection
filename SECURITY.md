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
- With `stateDir`, state is written to `memory-state.json` with `0600` permissions; the
  directory is created with `0700`.
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
- The writer lock rejects a live writer; a lock whose PID no longer exists is reclaimed.
- If delivery outcome is `unknown`, the core does not retry and blocks new proactive contact
  until the host reconciles it.
