# Contributing

Thanks for taking the time to improve AI Roleplay Recollection. This project is intentionally small:
plain ESM, no runtime dependencies, and behavior that can be tested offline.

## Before you start

- Read [README.md](README.md) and [docs/architecture.md](docs/architecture.md).
- For a behavior change, open an issue first so the boundary stays coherent.
- By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Development

```bash
node --version        # need >= 22
npm test              # 56 offline tests
npm run check         # syntax and package metadata
npm run verify        # syntax + tests + examples
```

There is no install step: the package has no dependencies. Use `npm install` only if you add
a dev tool; avoid adding runtime dependencies unless discussed first.

## Project layout

```text
src/        core implementation (ESM)
test/       node:test suites
examples/   runnable, offline demos
docs/       architecture, solitude, API, naming, verification, release notes
scripts/    check, verify, release-check, configure-repo
```

## Style

- 2 spaces, single quotes, semicolons, ESM imports with `.mjs` extensions.
- Keep functions small and explicit; prefer early returns to nested conditionals.
- Comments explain **why**, not what; do not narrate obvious code.
- No network, timers, platform SDKs, or hidden global state in `src/`.
- New behavior needs a regression test in `test/`; update docs and `CHANGELOG.md`.
- Do not commit `memory-state.json`, `.env`, API keys, or generated reports.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add ...
fix: correct ...
docs: explain ...
test: cover ...
chore: prepare ...
```

## Pull requests

- Keep the change focused; separate refactors from behavior changes.
- Include: what changed, why, how it was tested, and compatibility notes.
- Update `CHANGELOG.md` for user-visible changes.
- Make sure `npm run verify` passes.
- Do not include personal data, real chat logs, or credentials in fixtures.

## Reporting bugs

Use the bug report template and include:

- package version (`VERSION` or `package.json`);
- Node version and OS;
- minimal reproduction using synthetic data;
- expected vs actual behavior;
- relevant logs with secrets removed.

Security issues: see [SECURITY.md](SECURITY.md), not a public issue.
