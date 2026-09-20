# Viral Intelligence Revolution — module plan

Status: reviewed and aligned with specification; not approved for implementation.
Scope started: 2026-09-20
Branch: `baza200926-socialcrawl`

## Outcome and boundaries

Genius@Brains becomes a manual, local viral-intelligence pipeline for public
Instagram and Threads data. The terminal/Codex starts a run; the localhost app
shows the persisted run, ranked discoveries, evidence and reports.

The run uses four direct SocialCrawl discovery variants: Instagram EN, Instagram
PL, Threads EN and Threads PL. It applies a local platform-aware viral score,
enriches only the best candidates within a hard 100-credit SocialCrawl cap,
transcribes eligible media through Deepgram, and asks one Codex session to
produce per-content analyses and a cross-run synthesis.

Out of scope: Universal Search as the default engine, SocialCrawl transcripts,
automated visual/video understanding, scheduled crawling, private social data,
publishing from Genius@Brains, and replacing Genius@Content's rendering
pipeline.

## Modules

### M01 — Viral discovery, scoring and enrichment

Deliverable: configuration-driven bilingual discovery for Instagram Reels and
Threads, local deduplication and viral scoring, guarded SocialCrawl enrichment,
and raw evidence capture. As part of activation, remove only generated legacy
YouTube artefacts from the Genius@Brains output boundary; preserve existing
source, tests and schemas until replacement coverage is accepted.

Boundary: does not transcribe media, run Codex analysis, render reports, or
publish content.

Dependencies and provisional interfaces:

- consumes the editable niche/subtopic/query configuration;
- calls direct Instagram Reels Search and Threads Search endpoints, never
  Universal Search in the default path;
- emits a normalized candidate/evidence pack and a crawl budget ledger for M02
  and M03;
- uses M03 persistence interfaces for run state and raw artefact paths.

Relevant existing areas:

- `apps/genius-brains/src/config/`, `src/normalize/`, `src/export/`, `src/cli/`;
- existing Genius@Brains YouTube client/filter/ranking code is reference only
  and is removed or isolated from the active pipeline after replacement tests;
- `apps/genius-brains/output/` is the legacy artefact boundary.

Verification evidence:

- unit tests for four discovery variants, query expansion, deduplication,
  platform/language partitioning, viral-score weights and budget stopping;
- candidate selection capped at `min(5, ceil(20% of eligible candidates))` per
  variant with a topic-fit baseline of `0.6`;
- fixture tests for partial failures, empty results, pagination and cache hits;
- a dry-run budget report that never exceeds 100 SocialCrawl credits, with the
  approved 30/50/10/10 allocation and a hard preflight stop;
- cleanup tests proving that only Genius@Brains generated artefacts are touched.

### M02 — Transcription and Codex intelligence

Deliverable: Deepgram transcription for selected Instagram Reels and eligible
Threads videos, structured per-item analyses, and cross-run synthesis reports.

Boundary: no discovery, no SocialCrawl budget decisions, and no visual semantic
analysis. Text-only Threads posts use their root text and available replies.

Dependencies and provisional interfaces:

- consumes M01's selected candidate pack and media links;
- sends eligible media to Deepgram Nova-3 batch with multilingual settings,
  timestamps, formatting and conditional diarization;
- produces versioned JSON analysis records plus Markdown report artefacts;
- supplies M03 with evidence references rather than only terminal output.

Relevant existing areas:

- `apps/genius-content/src/lib/transcript-stage.ts`, local Whisper helpers and
  transcript types are reusable references, not a reason to couple Brains to
  the Content pipeline;
- `apps/genius-brains/src/export/` is a migration point for report writers.

Verification evidence:

- schema tests for Instagram and Threads analysis contracts;
- mocked Deepgram tests for multilingual media, expired URLs, no-audio media,
  timestamps and retry/failure metadata;
- deterministic Codex analysis-pack fixtures and report snapshot tests.

### M03 — Local history and Genius@Brains dashboard

Deliverable: SQLite index plus filesystem artefact store, run lifecycle/status,
and localhost dashboard views for run summary, viral radar, single-content
analysis and cross-run trends/report.

Boundary: does not own SocialCrawl calls or AI reasoning; it presents persisted
contracts from M01 and M02.

Dependencies and provisional interfaces:

- consumes M01/M02 normalized records and artefact references;
- exposes read models through the existing localhost server in
  `packages/canvas/src/`;
- keeps the existing three-module shell and Genius@Content preview flow intact.

Relevant existing areas:

- `packages/canvas/src/server.ts`, `src/index.ts`, `public/index.html`,
  `public/app.js`, `public/styles.css`;
- `apps/genius-brains/output/` and a new local database/artefact root;
- existing health/config/path utilities.

Verification evidence:

- migration and repository tests for run, candidate, evidence, transcript,
  analysis and report records;
- API/read-model tests for partial runs and empty states;
- browser/UI tests for all four views, source links, score breakdown and
  credit ledger.

### M04 — Genius@Scale Composio connection and publishing path

Deliverable: settings-driven discovery of Composio publishing-capable social
toolkits, managed account connection state, and an adapter path from approved
Genius@Content artefacts to supported publish actions.

Boundary: no hardcoded catalogue of unrelated toolkits and no forced native
platform implementation when Composio lacks the requested action. Fallbacks are
reported explicitly and remain a later contract decision.

Dependencies and provisional interfaces:

- consumes the existing publisher/calendar payloads in `apps/genius-scale/`
  and `packages/canvas/src/publisher/`;
- uses Composio managed OAuth/connection metadata and dynamically resolved
  action capabilities;
- feeds connection and publish status into the existing Scale settings/UI.

Verification evidence:

- mocked Composio catalogue, connection, token refresh and publish-action tests;
- settings tests proving unrelated toolkits are not shown;
- regression tests for existing Threads publisher and artifact contracts.

## Dependency order

1. Freeze shared schemas, config, budget ledger and persistence/artifact-store
   contracts (the M03 foundation interface).
2. Build the M03 persistence foundation and migration tests.
3. Build M01 discovery/scoring/enrichment fixtures against those contracts.
4. Build M02 transcription and structured analysis against M01 fixtures.
5. Complete M03 read models/dashboard against M01/M02 contracts.
6. Build M04 Composio adapter/settings integration without changing the Brains
   evidence pipeline.
7. Run whole-implementation review and final verification.

No implementation starts until this plan and the detailed specification are
reviewed and explicitly approved.
