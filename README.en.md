# Roleplay Recollection · 朝花夕拾

**Idle recollection, mind-wandering, and optional outreach for AI characters.**

Roleplay Recollection is a **character recollection behavior layer over existing memories**.

After a conversation pauses, a character can revisit a shared experience, linger on it, follow a small association, or leave quietly. If a wish to share emerges, the module proposes words for the host to use at a suitable moment.

朝花夕拾 (*Dawn Blossoms Plucked at Dusk*) evokes picking up fragments of an earlier day. Built for AI companion and roleplay developers, this behavior layer organizes **when to revisit memories, how to wander, and whether to propose an expression**. Existing memory systems can keep handling long-term storage and retrieval.

Node.js / JavaScript, with TypeScript declarations. Repository and package: `roleplay-recollection`.

[![CI](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml/badge.svg)](https://github.com/BCOIgv/roleplay-recollection/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.16-3c873a)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[中文](README.md) · [Core features](#core-features) · [How it differs](#how-it-differs-from-other-memory-components) · [Quick start](#quick-start) · [Existing memory sources](docs/read-only-sources.md)

> **Developer preview**: current `main` includes unreleased features and fixes. Public **v0.3.0** is an earlier snapshot without global source integration. See [versions and installation](#versions-and-installation) before choosing a package.

The core supplies recollection policy and state. Your host supplies idle context, invocation timing, and model execution, then decides on actual delivery. Installing the core alone starts no background worker and sends no messages. Solitude and thoughts describe simulated character behavior.

## Core features

- **Recollection between conversations**: once the host reports idle context, persisted opportunities, active hours, and budgets govern entry. Wandering has no current question to answer and no requirement to summarize, solve a task, or send a message.
- **Linger, follow, switch, or leave**: `linger / follow / switch / leave` organize a bounded walk. The local core uses lexical and tag overlap to help choose associations.
- **Separate thoughts from expression**: a session may leave a tentative private thought or produce no content. Thoughts do not automatically become new episodes or facts. The host can read still-valid thoughts for later conversations.
- **Propose words from remembered experiences**: a wish to share produces a short expression candidate. The host can weave it into a reply or use an allowed proactive contact window. Solitude delivery is settled with actual receipts; unknown delivery is not automatically replayed.
- **Respect source visibility**: recall uses currently visible material and preserves observation, report, and fiction labels. Local episodes can fade from quotes into impressions. Source revision, withdrawal, and availability affect derived content.
- **Bound the pace and prioritize conversation**: by default, a session takes at most 2 steps and shares a daily 2-call model budget with cue recall. Host-reported busy, pending-work, or awaiting-reply states block entry. The host must propagate cancellation or updated context for work already in progress.

Flow: **stored experiences → idle opportunity → bounded wandering → quiet exit / tentative thought / expression candidate → host-controlled use and delivery**.

The local core includes lightweight episode storage; current source also supports read-only JSON, JSONL, and SQLite data. Trying the policy does not require migrating all existing memories. The core is plain ESM with no third-party runtime dependencies.

## How it differs from other memory components

Long-term memory addresses what to retain, update, and retrieve. Roleplay Recollection focuses on a character behavior path: **when there is no question to answer, can a past experience resurface and lead to something the character might say?**

| Component | Public capabilities and focus | Relationship to this module |
| --- | --- | --- |
| Conventional RAG / vector retrieval | Find material for a query and supply answer context; applications can add other triggers | Can supply material. This module organizes idle opportunities, wandering, and expression candidates rather than replacing retrieval infrastructure |
| [Mem0](https://docs.mem0.ai/core-concepts/how-it-works) | Extract and retrieve memories; [Platform Dream](https://docs.mem0.ai/platform/features/dream) also synthesizes patterns, handles outdated facts, and merges duplicates | Some memory processing overlaps. This module focuses on character recollection and expression intent rather than user-fact consolidation; source mapping or an adapter is still needed |
| [Letta dreaming](https://docs.letta.com/configuration/memory) | Review conversations, consolidate lessons, and update persistent memory in the background | Background processing is shared territory. This module packages character wandering, tentative thoughts, optional expression, and valid quiet exits as a separate policy |
| [Idle prompts](https://github.com/SillyTavern/Extension-Idle) / [proactive chat extensions](https://github.com/mattjaybe/SillyTavern-EchoText) | Existing options include idle continuation, proactive contact, and shared-memory triggers | Proactive messages already exist. This module focuses on a reusable recollection–thought–expression flow and delivery settlement, with the chat interface supplied by the host |

These are differences in focus, not claims that other systems cannot implement similar policies. Use this module when you already have characters, memories, and a host, and want to explore **revisiting and occasionally sharing past experiences between conversations**. For factual memory, knowledge answers, or scheduled greetings alone, use the corresponding component. Real-model naturalness and benefits over simple timed prompts remain unvalidated.

## Implementation and research status

| Status | Scope |
| --- | --- |
| Implemented | Bounded recollection, tentative-thought access, expression candidates, and delivery settlement. The host must consume thoughts explicitly; later wandering and replies do not receive them automatically |
| Proposed, not implemented | Consistent termination semantics, voluntary stops inside hard limits, dynamic budgets, and short session state. See the [boundary review](docs/wandering-boundaries.md); runtime defaults remain unchanged |
| Unvalidated | Benefits over simple timed prompts in naturalness, memory fit, willingness to keep the feature, and value relative to cost and integration effort. See the [staged evaluation plan](docs/evaluation-plan.md) |

## Quick start

### 1. See an idle recollection session

Install **Node.js ≥ 22.16** and Git, then run the current source example:

```bash
git clone https://github.com/BCOIgv/roleplay-recollection.git
cd roleplay-recollection
node examples/solitude.mjs
```

The example stores shared experiences, advances a controlled clock to an opportunity, and follows a rainy-day memory to a joke about naming a paper whale. It proposes a short expression, blocks taking it while a user awaits a reply, then permits taking it in allowed idle context.

Check `result.reason: "wants_contact"`, `whileUserWaiting: null`, and `laterCandidate.sent: false`. The example uses **scripted model hooks and simulated time**, needs no API key, and sends no messages. It does not establish real-model naturalness. Its memory content is in Chinese. For the basic capture/retrieval interface, also run `node examples/basic.mjs`.

### 2. Understand the input: an episode with sources

Create `quickstart.mjs` in the cloned repository root and paste this complete example:

```js
import {CompanionMemory} from './index.mjs';

const memory = new CompanionMemory({
  characterId: 'reading-companion',
  scopeId: 'private:demo-user',
  mode: 'companion',
});

try {
  const saved = memory.capture({
    id: 'rainy-reading',
    truth: 'observed',
    occurredAt: Date.now() - 3600000,
    gist: 'Read The Little Prince together on a rainy day',
    tags: ['rain', 'reading'],
    evidence: [{
      id: 'message-001',
      kind: 'shared_event',
      text: 'It was raining outside while we read The Little Prince together.',
    }],
  }, {mode: 'companion'});

  const memories = memory.visible({
    mode: 'companion',
    trigger: 'cue',
    cue: 'Little Prince',
  });

  console.log(JSON.stringify({
    stored: saved.stored,
    memories: memories.map(({gist, detail}) => ({gist, detail})),
    modelCalls: memory.status().modelCallsToday,
  }, null, 2));
} finally {
  await memory.close();
}
```

Run `node quickstart.mjs`. Expected output:

```json
{
  "stored": true,
  "memories": [
    {
      "gist": "Read The Little Prince together on a rainy day",
      "detail": "specific"
    }
  ],
  "modelCalls": 0
}
```

### 3. Connect a real character host

Real solitude requires visible experiences, a `wander` model hook, and host-triggered `solitude()` calls with actual idle context. The host also receives expression candidates and calls `settleExpression()` after use. Scheduling between conversations runs in the host; this module does not poll chat platforms. See [model hooks](docs/api.md#3-模型钩子) and the [solitude lifecycle](docs/solitude.md).

Before generating a reply, call `visible()` with the current message as the `cue`. Pass the returned `memories` to your reply model as reference data, preserving `truth` and `detail`. Quote original text only when it appears in the returned `evidence`. After a conversation, have your application prepare meaningful episodes and call `capture()`.

For persistence across restarts, add `stateDir: './data/reading-companion'` to the constructor. Assign separate instances and directories to different characters, private chats, groups, or stories. Omitting `stateDir` keeps the example in memory.

`capture()` accepts structured episodes with evidence. Your host supplies chat collection and summarization. See the [API reference](docs/api.md) for details.

## Versions and installation

| Entry point | Use it for | Included features |
| --- | --- | --- |
| Current `main` source | Trying the latest implementation and developing integrations | Local core, read-only sources, global RP, and unreleased fixes |
| [GitHub Release v0.3.0](https://github.com/BCOIgv/roleplay-recollection/releases/tag/v0.3.0) | Reproducing a fixed release and evaluating earlier interfaces | Local core and legacy DSH bundle; see [historical validation and known issues](docs/verification.md) |

**Current source**: clone the repository as shown above and import by relative path. Run `npm ci` before development checks or TypeScript work.

**Public v0.3.0 core package**: run this in your own Node.js project directory:

```bash
npm install https://github.com/BCOIgv/roleplay-recollection/releases/download/v0.3.0/roleplay-recollection-0.3.0.tgz
```

Then change the example import to:

```js
import {CompanionMemory} from 'roleplay-recollection';
```

Public packages are provided as Release tarballs. Installing with `npm install roleplay-recollection` by package name is not currently a supported entry point; check [Releases](https://github.com/BCOIgv/roleplay-recollection/releases) for updates. v0.3.0 does not export the new `GlobalMemoryLibrary`, `GlobalRecollection`, or source initialization APIs.

## Memory inputs and supporting APIs

The local core stores recall material as **episodes**: each has a summary, timestamp, tags, and 1–3 original excerpts. These lightweight long-term and episodic memory APIs supply material for recollection and can also be used on their own:

1. **Capture**: the host supplies structured observations, reports, or story events for validation and storage.
2. **Retrieve**: lexical and tag matching select relevant episodes that remain visible.
3. **Fade**: ordinary episodes lose quoted details, become impressions, and eventually leave routine recall. Explicit retention follows the retention policy.
4. **Reflect when enabled**: host-provided model hooks can produce tentative thoughts or candidate expressions. Source revisions, withdrawal, and availability affect derived content.

Fading changes what the model can see. Original evidence may remain in local state. Use the relevant withdrawal interfaces when removal is needed; see the [API](docs/api.md) and [security notes](SECURITY.md).

### API and model calls

This table describes the local `CompanionMemory` core:

| API | Purpose | Extra model calls |
| --- | --- | --- |
| `capture` / `revise` / `forget` | Store, revise, or withdraw episodes | 0 |
| `visible` / `privateThoughts` | Get visible memories or still-valid tentative thoughts | 0 |
| `recollect({trigger: 'cue'})` | Cue recall with optional reflection or candidate expression | 0 or 1 |
| `solitude` / `recollect({trigger: 'idle'})` | Wander when due and quiet | Up to 2 per session by default, subject to the daily budget |
| `takeExpression` / `settleExpression` | Take candidates and settle solitude delivery receipts | 0 |

The default daily model budget is **2 calls**, shared by cue recall and solitude. Without `reflect` / `wander`, the core makes no model calls. Your host manages provider credentials, model requests, and cancellation; see [model hooks](docs/api.md#3-模型钩子).

### Solitude and candidate expressions

Your host schedules solitude. The default base opportunity interval is 72–120 hours, with inactivity and active-hour checks; new episodes can accelerate an opportunity. The model may continue wandering or end quietly.

Expressions are candidates for the host to use in a reply or an optional later contact. Solitude contact is settled using actual delivery receipts. The [solitude example](examples/solitude.mjs) uses scripted model hooks and sends no messages. See the [solitude design](docs/solitude.md) for the full rules.

## Existing memory sources and DSH

### JSON, JSONL, or SQLite data

**Current source only**: register external data through read-only adapters, validate field mappings, and use host-authorized global retrieval and character recall. The original system maintains source data; this plugin stores mappings and runtime state separately.

The host must supply trusted identity, audience permissions, and model services. Reads use snapshots with byte and record limits; global queries use text containment matching. See the [read-only sources and global RP guide](docs/read-only-sources.md) for setup and constraints. Run the offline flow with:

```bash
node examples/global.mjs
```

### DSH plugin

The repository includes the `roleplay-recollection-dsh` bundle:

| Mode | Entry point and capabilities |
| --- | --- |
| Local | 11 tools for one configured character and scope; included in public v0.3.0 |
| Global | 9 tools added in current source for external retrieval, recall, and solitude; requires trusted host services |

The legacy local bundle exposes capture and retrieval tools without model executors or a solitude tool. Global mode uses host services for models and authorization. See the [DSH guide](dsh/README.md) for installation of both packages, scope configuration, and host requirements.

## FAQ

**Do I need a vector database, embeddings, or a model API key?** Capture and routine retrieval run locally. Model reflection and solitude generation require host-provided model hooks; the host chooses local or remote models.

**Can I install it directly in SillyTavern or run it as an MCP server?** This repository supplies a Node.js core and a DSH bundle. A SillyTavern extension, standalone MCP server, or other platform adapter would need a separate implementation.

**Why is a saved episode missing from recall?** Check `stored` and `reason` from `capture()`, confirm `mode` and `storyId` match the instance, and choose a cue present in the gist, tags, or currently visible excerpts. Duplicate sources, low salience, pause, unavailable sources, and dormancy can affect results. The local core stores up to 200 episodes by default, configurable to 500.

**What does a production integration need?** The host supplies session routing, authorization, episode extraction, reply context, optional scheduling, model calls, and delivery. State files are unencrypted, and directory permissions depend on the host environment. Real DSH service bridging, model naturalness, and long-running behavior still need separate validation. See the [verification notes](docs/verification.md) for the tested scope.

## Development and contribution

From the repository root:

```bash
npm ci
npm run verify
npm run check:types
npm run release:check
npm run verify:consumer
```

These checks cover offline tests, synthetic examples, type declarations, and installed tarball consumers. Open an [issue](https://github.com/BCOIgv/roleplay-recollection/issues) with reproduction steps, source formats, or host integration needs. Read the [contribution guide](CONTRIBUTING.md) before contributing.

## Documentation

| Document | Contents |
| --- | --- |
| [API reference](docs/api.md) | Local core settings, methods, model hooks, and results |
| [Read-only sources and global RP](docs/read-only-sources.md) | Source mapping, authorization, runtime, and DSH services |
| [Architecture](docs/architecture.md) | Data flow and host responsibilities |
| [Solitude design](docs/solitude.md) | Opportunities, wandering, and delivery settlement |
| [Boundary review](docs/wandering-boundaries.md) | Current limits, candidate changes, and unresolved parameters |
| [Independent-value evaluation plan](docs/evaluation-plan.md) | Controls, ablations, ratings, costs, and stage decisions |
| [Naming and display guide](docs/naming.md) | Brand, subtitles, GitHub description, and topics |
| [Verification](docs/verification.md) | Current source and public v0.3.0 validation |
| [Changelog](CHANGELOG.md) | Released and unreleased changes |

The integration and design guides are currently in Chinese. The [DSH guide](dsh/README.md) is in English.

[MIT](LICENSE) © 2026 AI Roleplay Recollection contributors
