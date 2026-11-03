# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-11-03

First public release under the names **AI Roleplay Recollection** (GitHub / npm) and **朝花夕拾** (Chinese). Formerly `companion-recollection`.

### Added

- Solitude opportunities: persisted 72–120 hour interval, growth acceleration by 12–20 new
  episodes, 48 hour minimum gap, 10:00–22:00 Shanghai window, 24 hour expiry, no catch-up.
- Unstructured wandering: up to 2 steps by default, `leave / linger / follow / switch`,
  private thoughts, and optional `shareText` that ends the session.
- Contact intents: created only after solitude ends, 24 hour expiry, pending/taken/sent/
  used_in_reply/not_sent/unknown lifecycle.
- Receipt-based reconciliation: only real `sent` or `used_in_reply` receipts update contact
  cooldown; unknown delivery is not replayed.
- Stale writer-lock recovery for persistent state, with live-writer protection.
- TypeScript declarations (`index.d.ts`) and a minimal `examples/basic.mjs`.
- 2 store-lock regression tests (56 offline checks total).

### Changed

- `recollect({trigger:'idle'})` now delegates to the persisted solitude opportunity instead of
  performing an immediate short-cooldown recall.
- Package metadata prepared for public release: MIT license, `files` whitelist, `exports`,
  repository/bugs/homepage fields, `prepublishOnly` verification.
- Documentation rewritten for the current architecture; historical reading/book-shelf notes
  removed from the public docs.
- `visible()` remains the zero-extra-call lookup for ordinary companion replies.

### Removed

- Unused `idleChance` configuration (it was validated but never read).
- Raw TAP/JSON reports from the published tree; CI and `npm test` are the current evidence.
- The old `UNLICENSED` private-prototype license.

### Fixed

- `takeContact` now tolerates an omitted context object instead of reading `delivery` from
  `undefined`.
- State-directory validation no longer rejects valid paths whose parent is a symlink; it
  rejects only a state directory that is itself a link.
- `status()` no longer relies on index alignment between all episodes and the visible views.

### Security

- Error messages are redacted for `sk-...`-style secrets before being stored in run records.
- State files are written with `0600` permissions and state directories with `0700`.
- The core performs no network requests and sends no messages.

## [0.2.0] - 2026-11-02

### Added

- Source-backed episodes with truth labels (`observed`, `reported`, `fictional`) and 1–3 evidence
  excerpts.
- Time-based fading from specific detail to impression, then dormancy.
- Cue-based recall, private tentative thoughts, and optional expression candidates.
- Story/companion isolation, revision, withdrawal, source availability, pause, and persisted
  call budgets.
- State file version 2 with atomic writes and a writer lock.

[0.3.0]: https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0
[0.2.0]: https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.2.0
