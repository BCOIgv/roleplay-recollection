# Evaluation tools

These scripts exercise the current core and experimental hosts. They are not a production scheduler or message transport. Public fixtures are synthetic. Private materials, identity maps and outputs belong outside the repository.

## Entry points and storage

| Files | Purpose |
| --- | --- |
| `offline-boundaries.mjs` | 22 scripted local/global boundary probes |
| `condition-host.mjs`, `offline-conditions.mjs`, `check-conditions.mjs` | Scripted A/B/C/C0/B+T adaptation and isolation checks |
| `batch-scenarios.mjs`, `run-batch.mjs` | Six synthetic single-opportunity live/dry-run scenes |
| `timeline-scenarios.mjs`, `timeline-host.mjs`, `run-timeline.mjs` | Three synthetic multi-session timelines, three sessions and three turns per session |
| `audit-results.mjs`, `results/` | Aggregate frozen synthetic reports and store reviewed public summaries |
| `templates/` | Recording formats for future studies; not completed ratings |
| `reports/` | Generated prompts, responses and per-condition state; Git/npm excluded |

`latest-report.*` and `latest-timeline-report.*` are overwritten by either mode. Fixed raw JSON lives in `reports/runs/<run-id>/report.json`; preserve it before reviewing a result. Historical successful and failed batches are summarized in [results/README.md](results/README.md).

## Synthetic dry-run and live runners

```bash
node evaluation/run-batch.mjs --dry-run
node evaluation/run-timeline.mjs --dry-run
```

Dry-run calls scripted hooks only and writes complete assembled messages to JSON. Markdown provides a readable summary. No credentials or network are required. Both public runners reject inputs not marked `data_origin: synthetic` before any API call. This label is a guard, not a detector of personal information; review fixtures before publication.

For a separately scoped live run, inject `OPENAI_API_KEY`, `OPENAI_BASE_URL` and `EVAL_MODEL` into the process, then choose one runner:

```bash
node evaluation/run-batch.mjs --live
node evaluation/run-timeline.mjs --live
```

The client uses native fetch with an OpenAI-compatible chat completions endpoint. It records content, provider usage, latency, finish reason and model label. No pricing or user feedback is inferred. Unknown usage remains null. Failed requests/conditions are retained and produce a nonzero exit; a valid API response can still fail the core's decision validation.

The single-opportunity runner forwards the core's token request. Timeline runner-v2 explicitly uses an experimental API allowance of **2000 tokens** (at least the hook request), records both requested_max_tokens and actual max_tokens, and performs **no automatic retries**. This does not change the core default of 500 or its allowed range of 64–800. It also records implementation hashes and timeline snapshots and persists before/after transport calls. Legacy reports did not preserve all this information; see the results limitations.

## Experimental timeline conditions

| Condition | Idle path | Reply input |
| --- | --- | --- |
| A | No idle call | Experimental lexical/recency Top-5 plus conversation history |
| B | One prompt over two surface memories | Same passive retrieval; candidate omitted by default |
| C | GlobalRecollection with host-selected pool and continuation hints | Passive retrieval plus experimental tentative-thought ledger |
| C0 | Reuses paired C idle artifacts without new idle calls | Thoughts masked; generates its own rolling replies |
| B+T | One prompt with optional thought | Passive retrieval plus its thought ledger |

Current timeline host is `llm-timeline-host-v2`; the scripted helper version is `scripted-timeline-host-v2`. Thoughts and their anchored source text are host-managed experimental context, not new facts. The host exports only thoughts accepted by the core and checks that the source text is still visible before reply injection. This ledger differs from the core's public `privateThoughts()` return of at most three items. It does not automatically feed earlier thoughts into the next wandering step.

The host deliberately arranges surface/bridge material and primes a controlled clock, including synthetic opportunity-expiry checks for long gaps. It does not reconstruct real historical eligibility. C's prompt encourages first-step follow; global follow itself has no semantic association selector. B/B+T have different gating and idle-context inputs. These conditions are mechanism probes, not a material- and budget-matched superiority study.

`--proactive-open` adds the candidate to simulated conversation context and the first reply input. It still sends nothing and does not simulate a recipient's response. The recorded live batches used the default `false` value. All candidates remain not_sent.

## Run the offline boundary probes

From the repository root:

```bash
node evaluation/offline-boundaries.mjs --output .verify/evaluation/offline-boundaries.json
```

The script exercises 11 synthetic situations in each runtime, for 22 checks. It uses
in-memory sources, a controlled clock, and scripted hooks. Fixture overrides use settings
already accepted by the core; they do not change `DEFAULTS` or select future defaults.
No API key is needed, and no messages are sent. Global results without a detailed public
finish reason retain `null`; they are not relabeled as voluntary exits.

## Run scripted condition adaptation

```bash
node evaluation/check-conditions.mjs
node evaluation/offline-conditions.mjs --cases <private-case-directory> --output <new-private-output-directory>
```

`check-conditions.mjs` runs only a synthetic case through 40 condition/variant runs.
`offline-conditions.mjs` reads normalized case JSON and runs A (passive), B (single
scripted reflection), C (the current global wandering path), C0 (paired C artifact with
thoughts masked from later reply context), and B+T (single scripted reflection with a
tentative thought). Normal, quiet, and protocol-failure variants are recorded for every
case. Additional synthetic checks cover foreground priority, cancellation, withdrawal,
permission revocation, and unknown delivery. Existing boundary probes cover shared
budgets and hard limits.

The host uses the real read-only JSONL library and public global runtime for schema,
authorization, candidate validation, and settlement. B uses a single cue invocation
with a frozen one-shot prompt identifier; this is a flow adapter, not a completed live
baseline prompt study. All responses in this offline adapter remain scripted; the separate live runners above call models. C0 reuses C's artifact
without a second model invocation and gets an independent output/state directory.

Host version `scripted-condition-host-v1` explicitly places valid tentative thoughts in
a *subsequent reply-context artifact* for C/B+T and masks them for C0. It does not alter
core prompts, automatically feed thoughts into later wandering, or call a reply model.
The later question enters only that artifact after idle generation. The host primes a
controlled clock to a due opportunity with existing defaults; it does not reconstruct
the historical host's actual eligibility or prior delivery ledger.

Inputs require audience, availability and event timestamps, visible evidence, split,
persona, and a later question. Source snapshots and state directories are separate.
Wrong-audience and future-availability decoys test filtering. A candidate remains
`sent: false`; normal scripted settlement is `not_sent`, and the unknown-delivery
variant verifies that taking it again is blocked. No transport is installed.

The CLI requires a new output directory outside the repository and input case tree.
It writes full private context and artifacts there, so do not copy them into public
issues, fixtures, or commits. Synthetic samples belong in source; private dataset IDs,
source paths, scope maps, counts, and results do not.

## Study preparation files

- [manifest.example.json](templates/manifest.example.json): copy before a future stage,
  freeze implementation/configuration and fill unresolved study decisions.
- [events.example.jsonl](templates/events.example.jsonl): synthetic format examples for
  opportunity, call, and session records, not measured study results.
- [ratings.example.jsonl](templates/ratings.example.jsonl): blank content and pairwise
  rating records, not completed judgments.

Copy future run files into an ignored location such as `.verify/evaluation/<study-id>/`.
Store sensitive source material separately; use local controlled references in logs.
Templates and this script do not enable or authorize later stages.

## Event dictionary

| Field | Meaning |
| --- | --- |
| `schema_version`, `synthetic` | Recording format and whether content is synthetic |
| `study_id`, `stage` | Frozen study identity and P0–P5 stage |
| `case_id`, `opportunity_id`, `run_id` | Scenario, shared opportunity, and condition execution; all attempts remain linked |
| `condition_id`, `sample_id` | Assigned arm and repeated generation within the scenario |
| `runtime_mode`, `timestamp` | Local/global path and timezone-qualified event time |
| `event`, `eligible`, `skip_reason` | Opportunity/call/session/candidate/take/settlement/reply/feedback and its eligibility |
| `material_refs`, `thought_refs` | IDs plus revision/visibility/audience binding references; no credentials or raw private text |
| `model_action`, `finish_reason`, `reason_source` | Action observed and actual end cause; null/unavailable when not exposed |
| `active_limits`, `requested_continuation` | All simultaneous resource limits and whether the last model action asked to continue |
| `usage`, `usage_source`, `cost`, `cost_source` | Provider tokens/latency and billed or estimated cost; unknown fields are null |
| `candidate_ref`, `delivery_status`, `receipt_ref` | Proposal and actual delivery lifecycle; `sent` requires a real receipt |
| `private_payload_ref`, `protocol_error` | Controlled local artifact reference and validation error if any |

Candidate, take, settlement, reply-generation and user-feedback events are future host
records, not telemetry currently exported by the core. Live reports record calls and failures; future studies must also record every transport attempt, cancellation and retry. Core call counters and a
provider bill are different data sources.

## Rating dictionary

Content records contain anonymous item IDs and a task type (`candidate`, `reply`, or
`opportunity`). Naturalness, memory fit, association plausibility and character/context
fit use the anchored 1–5 scales in the plan. Repetition and factual violations are
separate fields. Missing or inapplicable scores stay null.

Pairwise records contain randomized left/right item IDs, evaluator ID and one of:
`left`, `right`, `tie`, `neither_should_speak`. The evaluator must not see condition IDs,
brand, generation trace or cost. Keep the item-to-condition mapping outside the blinded
rating file. Opportunity tasks can compare a no-action option; do not score passive
memory's absent candidate as poor prose.

Thought consumption tests use the same wandering artifact for C/C0 and change only
whether a valid tentative thought is exposed to the reply model. A thought is never
promoted to a fact. The host must record whether a thought was actually available and
consumed, so zero exposure is not misread as zero causal value.
