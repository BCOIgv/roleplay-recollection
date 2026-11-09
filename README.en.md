# Roleplay Recollection · 朝花夕拾

**Idle recollection, mind-wandering, and optional outreach for AI characters**

Roleplay Recollection is a **character recollection behavior layer over existing memories**. A host invokes it between conversations to revisit available experiences, linger, continue sampling, or leave quietly. Tentative thoughts and expression candidates are separate outputs. The host controls timing, cancellation, reply context and delivery.

The Chinese name evokes revisiting fragments of the past. This repository provides a Node.js ESM library, TypeScript declarations and a DSH bundle for developers with an existing character and memory system. Installing the core starts no background scheduler and sends no messages.

[![CI](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml/badge.svg)](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.16-3c873a)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[中文](README.md) · [Quick start](#quick-start) · [Evaluation results](evaluation/results/README.md) · [API](docs/api.md) · [Documentation](docs/README.md)

> Developer preview: `main` includes unreleased global-source APIs and fixes. Package versions remain `0.3.0`; the historical [v0.3.0 Release](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0) has different contents.

## Core features

- Persisted idle opportunities, activity windows and bounded wandering. A run has no required useful output and can end without thoughts or expressions.
- Tentative thoughts and optional expression candidates. Thoughts are not automatically passed to later wandering or replies; the host must explicitly consume them.
- Source identity, revisions, withdrawals and visible projections. A valid quote anchor establishes a substring match, not the truth of an entire generated statement.
- Foreground checks and cancellation hooks. A new busy call on the global runtime skips that call; the host must cancel the original request separately.
- Defaults of two steps per solitude session and two shared model calls per day, with a 30-second call timeout. See [configuration](docs/api.md#行为参数).

`CompanionMemory` stores scoped episodes, applies fading and uses lexical/tag overlap for local follow selection. `GlobalMemoryLibrary` and `GlobalRecollection` read authorized native state, JSON, JSONL or SQLite sources. Global follow samples remaining material; it does not implement the local association weighting. Both paths require host integration. The core has no third-party runtime dependencies.

## How it differs from other memory components

| Component | Scope and relationship |
| --- | --- |
| RAG / vector retrieval | Query-driven material retrieval can supply inputs. This project has no built-in vector store |
| [Mem0 Dream](https://docs.mem0.ai/platform/features/dream) | Background pattern synthesis, outdated-fact handling and deduplication overlap with background memory processing. This project focuses on character recollection and candidate expression rather than maintaining facts in an external store |
| [Letta dreaming](https://docs.letta.com/configuration/memory) | Reviews conversations and updates memory in the background. Background reflection is not unique to this project |
| [Extension-Idle](https://github.com/SillyTavern/Extension-Idle) / [EchoText](https://github.com/mattjaybe/SillyTavern-EchoText) | Existing idle prompts and proactive character chat. This project provides embeddable recollection state and delivery settlement, without a chat UI or SillyTavern adapter |

These are design distinctions based on public project descriptions, not quality rankings. Experience gains over a simple scheduled prompt remain unestablished.

## Recorded evaluation

| Synthetic run | Recorded requests | Tokens | Recorded failed calls / conditions |
| --- | --- | --- | --- |
| Six single-opportunity scenes, five conditions | 50 | 35,990 | 0 / 0 |
| Three timelines, DS4.1 route | 167 | 245,064 | 0 / 0 |
| Same timelines, WorkBuddy DS4.1 route | 167 | 249,316 | 0 / 0 |

Each timeline has three sessions with three fixed user turns; each condition generated 27 replies across the three timelines. Time was simulated, no messages were delivered and no blind human or retention study was performed.

The timeline host partly prescribes bridge memories, encourages C to continue on the first step and explicitly injects an experimental thought ledger. It is not the default core or DSH behavior. The two complete runs also changed injection and API output limits, so they do not establish provider equivalence or stability.

In the WorkBuddy run, C reached the prescribed old memory, but none of the three final-session replies explicitly named its osmanthus oolong detail. Retrieval, candidate generation and reply benefit are separate outcomes. C used about 1.15 times B+T's tokens and 1.62 times A's in that batch; these are not general cost forecasts. See the [audited summary](evaluation/results/README.md) for fixed report hashes, failed runs and study limitations.

## Quick start

Use Node.js ≥22.16 and Git:

```bash
git clone https://github.com/BCOIgv/roleplay-recollection.git
cd roleplay-recollection
node examples/basic.mjs
node examples/solitude.mjs
node examples/global.mjs
```

Examples use synthetic material, scripted model hooks and a controlled clock. No API key is required. The solitude example demonstrates a candidate, foreground gating and later retrieval; `sent` remains `false`.

For a real host, provide structured experiences or authorized sources, a `wander` hook and calls to `solitude()` with verified activity context. Supply visible memories and any still-valid thoughts to your reply model explicitly. Add `stateDir` for persistence; isolate character/audience identities and state directories. See the [model hook contract](docs/api.md#3-模型钩子) and [source integration guide](docs/read-only-sources.md).

## Versions and installation

Use a source checkout for current APIs. Run `npm ci` for development dependencies. To install in a separate Node.js/DSH environment, build the matching core and bundle tarballs as described in [DSH installation](dsh/README.md#current-source).

The [v0.3.0 Release](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0) provides historical tarballs without global APIs and subsequent fixes; see [historical verification](docs/archive/verification-2026-11-07.md#公开-v030-的历史验证). Package-name-only registry installation is not a documented supported route.

## Host integration

External readers use bounded snapshots, not a streaming or semantic index. Local DSH mode exposes 11 episode tools without a solitude tool or model executor. Current global DSH mode exposes nine tools and requires trusted host services for access and models. Experimental reply injection has not become the default DSH reply path. See [dsh/README.md](dsh/README.md).

## Development and layout

```bash
npm ci
npm run verify
npm run check:types
npm run release:check
npm run verify:consumer
node evaluation/run-batch.mjs --dry-run
node evaluation/run-timeline.mjs --dry-run
```

| Directory | Contents |
| --- | --- |
| `src/`, `index.mjs`, `index.d.ts` | Core implementation and exports |
| `dsh/`, `examples/` | Adapter and runnable synthetic examples |
| `test/`, `typecheck/`, `scripts/` | Regression, type, package and installation checks |
| `evaluation/`, `evaluation/templates/` | Runners, synthetic fixtures and blank recording formats |
| `evaluation/results/` | Reviewed synthetic aggregates without raw chat or credentials |
| `evaluation/reports/` | Local generated reports/state, excluded from Git and npm |
| `docs/`, `docs/archive/` | Current documentation and historical diagnoses/verification |

Keep real memories, identity maps and private outputs outside the repository. [Boundary alternatives](docs/wandering-boundaries.md) and the [study protocol](docs/evaluation-plan.md) describe proposed work, not completed features.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [MIT](LICENSE)
