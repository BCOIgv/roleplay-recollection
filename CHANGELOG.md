# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Read-only native JSON, mapped JSON/JSONL and SQLite sources with bounded snapshots,
  schema fingerprints, signed pagination and explicit partial-source reports.
- Host-authorized global retrieval and a reference-based RP runtime: global cue recall,
  solitude, audience-bound thoughts, source revalidation and durable delivery settlement.
- First-run deterministic/model-assisted mapping, validated configuration persistence,
  and DSH global tools through explicit trusted host services.
- Consumer tarball checks, TypeScript compilation, Windows ACL probes and regression tests.

### Fixed

- Retry bounded Windows EPERM/EACCES/EBUSY failures while creating or removing the writer guard; preserve permanent failures and execute the transaction only once.

- Writer-lock initialization/reclamation race; unknown locks now fail closed.
- Source changes retain minimal taken/unknown delivery records while erasing their text.
- Stable evidence identity prevents edited-excerpt recapture for newly captured records.
- DSH default mode, foreground-work checks, nullable storyId and idle return declarations.
- Include DSH LICENSE and global adapter in the package.

### Requirements

- Node.js >=22.16 for the SQLite API. TypeScript is a development-only dependency.
- Public v0.3.0 assets remain the historical release; these changes are not yet published.

### Documentation

- Standardize the 朝花夕拾 / Roleplay Recollection brand, functional subtitles, package
  descriptions, DSH locales, and display assets without renaming packages or repositories.
- Add wandering-boundary alternatives and a staged independent-value study protocol,
  with packaged synthetic-only probes and recording templates; preserve runtime parameter defaults.
- Rewrite Chinese and English entry points around idle character recollection and
  optional expression, with a solitude demo, explicit source/release choices, and DSH modes.
- Add product positioning, ecosystem overlap, naming, validation needs, and suggested
  repository metadata. Use a matching cue in the basic offline demo.
- Distinguish the GitHub release from unavailable npm packages and document tarball installation.
- Shorten entry-point, naming, verification, and release documentation.
- Clarify view-based fading, model timeout timers, host responsibilities, filesystem permissions,
  and known 0.3.0 validation gaps. Published v0.3.0 artifacts remain unchanged.

## [0.3.0] - 2026-11-03

First public GitHub release under the title **AI Roleplay Recollection** (package: `roleplay-recollection`) and **朝花夕拾** (Chinese). Formerly `companion-recollection`.

### Added

- Solitude opportunities: persisted 72–120 hour interval, growth acceleration by 12–20 new
  episodes, 48 hour minimum gap, 10:00–22:00 Shanghai window, 24 hour expiry, no catch-up.
- Unstructured wandering: up to 2 steps by default, `leave / linger / follow / switch`,
  private thoughts, and optional `shareText` that ends the session.
- Contact intents: created only after solitude ends, 24 hour expiry, pending/taken/sent/
  used_in_reply/not_sent/unknown lifecycle.
- Receipt-based reconciliation: only real `sent` or `used_in_reply` receipts update contact
  cooldown; unknown delivery is not replayed.
- PID-based writer-lock recovery for persistent state. The initialization race is documented in the current verification notes.
- TypeScript declarations (`index.d.ts`) and a minimal `examples/basic.mjs`.
- Separate `roleplay-recollection-dsh` bundle with a configuration patch, locale metadata, and 11 tools.
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
- Creation requests POSIX `0600` for state files and `0700` for new directories; Windows ACLs and existing directory permissions require host configuration.
- The core performs no network requests and sends no messages.

## 0.2.0 - 2026-11-02 (unpublished prototype)

### Added

- Source-backed episodes with truth labels (`observed`, `reported`, `fictional`) and 1–3 evidence
  excerpts.
- Time-based fading from specific detail to impression, then dormancy.
- Cue-based recall, private tentative thoughts, and optional expression candidates.
- Story/companion isolation, revision, withdrawal, source availability, pause, and persisted
  call budgets.
- State file version 2 with atomic writes and a writer lock.

[0.3.0]: https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0
[Unreleased]: https://github.com/BCOIgv/roleplay-recollection/compare/v0.3.0...HEAD
