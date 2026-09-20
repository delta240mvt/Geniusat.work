# Viral Intelligence Revolution — specification

Status: reviewed; not approved for implementation.
Scope started: 2026-09-20
Branch: `baza200926-socialcrawl`

## 1. Observable workflow

The user runs a manual Genius@Brains crawl from the terminal. The command
creates a run, executes four direct discovery variants, ranks and deduplicates
the results locally, enriches only selected candidates, writes raw evidence,
and leaves the run in `complete`, `partial` or `failed` state. A separate
manual Codex analysis command consumes the run's analysis pack and writes
structured item analyses plus a synthesis report. The localhost app reads the
same persisted records and never depends on terminal output being present.

The four discovery variants are fixed at the pipeline level but their queries
are editable configuration:

```text
instagram/en
instagram/pl
threads/en
threads/pl
```

There is no automatic scheduler in this scope.

## 2. Configuration contract

The new viral-intelligence job is validated with Zod and has this shape:

```json
{
  "niche": "AI",
  "subtopics": ["AI agents", "AI coding", "AI automation"],
  "queries": {
    "instagram": { "en": ["AI agents"], "pl": ["agenci AI"] },
    "threads": { "en": ["AI agents"], "pl": ["agenci AI"] }
  },
  "lookbackDays": 30,
  "budget": {
    "maxCredits": 100,
    "discoveryCredits": 30,
    "instagramCommentsCredits": 50,
    "threadsEnrichmentCredits": 10,
    "reserveCredits": 10
  }
}
```

Invariants:

- `maxCredits` must equal 100 for the first test profile and cannot be raised
  by a command-line override;
- the four allocation fields must sum to `maxCredits`;
- every query belongs to one of the four variants and must be non-empty;
- `lookbackDays` is a local freshness boundary; the Instagram discovery call
  does not use its date filter because that can remove view counts;
- secrets are read from environment variables and are never written to the
  job file, SQLite or report artefacts.

The default configuration lives under the Genius@Brains input/config boundary;
the exact filename may follow the existing config convention, but the parsed
shape above is the stable contract.

## 3. CLI contract

The active commands are:

```text
genius-brains crawl --config <path>
genius-brains analyze --run-id <id>
genius-brains report --run-id <id>
genius-brains list-runs
```

`crawl` performs SocialCrawl discovery, local ranking and guarded enrichment.
It does not call Deepgram or Codex. `analyze` performs the Deepgram eligibility
stage when needed, builds the local analysis pack and runs the two Codex stages.
`report` regenerates the persisted Markdown/JSON report from stored records
without making paid SocialCrawl calls. `list-runs` is read-only.

The existing YouTube commands may remain as compatibility code while the new
pipeline is introduced, but they are not part of the new Genius@Brains active
workflow. Existing source/tests are not deleted as part of artifact cleanup.

## 4. SocialCrawl and budget contract (M01)

### Discovery calls

Instagram uses `/v1/instagram/search/reels` with `query`, `page`/`cursor` and
no `date_posted`. Threads uses `/v1/threads/search` with `query`, the local
date bounds, `limit`/`cursor`, `expand=false` and `relevance=filter`.

The implementation may make multiple one-credit calls per variant, but the
preflight ledger must reserve the documented cost before each call. It must
stop before a call when the remaining budget cannot cover its maximum cost.
Cache hits and provider refunds are recorded as zero/net-zero actual spend.

### Local ranking

Every candidate retains raw metrics as nullable values; missing is never
converted to zero. Candidates are deduplicated by canonical platform/post id,
then partitioned by platform, language and configured subtopic.

The score is normalized to 0–100 and initially uses:

```text
40% engagement velocity
25% comment/reply volume and, after enrichment, comment quality
20% relative views/reach
10% likes/reposts
 5% freshness and topic fit
```

Relative metrics are percentile/normalized comparisons within the candidate's
platform, language and subtopic. The initial score uses available discovery
metrics; after comments are fetched, the final score may be recalculated using
comment quality. No large-account advantage is allowed solely because of
follower count. Candidates outside the configured freshness boundary or below
the baseline topic-fit threshold of `0.6` are excluded from enrichment but
remain visible as rejected evidence. Threads also sends
`relevance_threshold=0.6`; Instagram uses the local topic-fit calculation
because its direct Reels endpoint does not expose the same relevance filter.

### Enrichment

The default test allocation is hard-coded by the validated budget profile:

- 30 credits for discovery and pagination;
- 50 credits for Instagram comments on the selected top candidates;
- 10 credits for Threads comments/views enrichment;
- 10 credits held as safety reserve for pagination, retries or additional
  engagement.

The run may spend less than 100 credits. It may never spend more. A partial
provider failure does not trigger an unbounded retry loop; the error, endpoint,
estimated cost and actual charge are persisted.

The exact candidate count is budget-derived: select the top
`min(5, ceil(20% of eligible candidates))` from each variant, reduced
automatically when the ledger cannot afford the enrichment. Instagram discovery metrics are retained from search and comments
are fetched only for selected reels. Threads selected posts may receive view
enrichment and the default reply window; text and reply data are then attached
to the candidate. No enrichment call is made for rejected candidates.

## 5. Normalized candidate contract (M01 → M02/M03)

Each candidate has at least:

```json
{
  "candidateId": "instagram:post-id",
  "runId": "run-2026-09-20T12-00-00Z",
  "platform": "instagram",
  "language": "en",
  "subtopic": "AI agents",
  "sourceQuery": "AI agents",
  "sourcePostId": "post-id",
  "sourceUrl": "https://…",
  "contentType": "reel",
  "text": "…",
  "mediaUrls": ["https://…"],
  "thumbnailUrl": "https://…",
  "publishedAt": "2026-09-20T10:00:00.000Z",
  "author": { "username": "…", "displayName": "…" },
  "metrics": {
    "views": 0,
    "likes": 0,
    "comments": 0,
    "replies": 0,
    "reposts": 0,
    "shares": null
  },
  "score": {
    "discovery": 0,
    "final": null,
    "components": {}
  },
  "evidence": {
    "rawPayloadPath": "…",
    "commentsPath": null
  }
}
```

Platform-specific fields remain nullable rather than being fabricated. A
candidate always keeps its original URL for manual review.

## 6. Run and persistence contract (M03)

SQLite is the index; filesystem artefacts hold raw/large data. Node's available
SQLite runtime is preferred over a new ORM. The database stores at least:

- `runs`: id, crawl status, analysis status, started/finished timestamps,
  config hash, budget totals and error summary;
- `crawl_calls`: run id, variant, endpoint, request fingerprint, estimated
  cost, actual credits, status, provider request id, raw payload path;
- `candidates`: normalized candidate fields, discovery/final score and
  rejection/enrichment status;
- `engagement`: candidate id, metric snapshot, captured timestamp;
- `comments`: platform comment id, candidate id, author, text, metrics, parent
  id when available and raw evidence path;
- `transcripts`: candidate id, provider, status, language, confidence, text,
  segments/words artefact path and error;
- `analyses`: candidate id, schema version, JSON artefact path, status and
  evidence completeness;
- `reports`: run id, report type, schema version, JSON/Markdown paths;
- `artefacts`: run id, kind, path, checksum and created timestamp.

Raw JSON, transcript JSON, analysis JSON and Markdown reports are stored below
a run-specific filesystem directory. Paths are relative to the configured
Genius@Brains data root and are not accepted from untrusted API responses.

Run status rules:

- `planned` → `running` when the crawl starts, before the first provider call;
- crawl status `complete` when every requested crawl call/enrichment stage has
  a terminal success/skip; analysis status is tracked independently as
  `pending`, `running`, `complete`, `partial` or `failed`;
- `partial` when at least one variant or enrichment stage failed but usable
  candidates remain;
- `failed` when no usable candidate or persistence contract can be completed.

The dashboard shows both statuses, so a completed crawl with pending analysis
is not misreported as a finished intelligence report.

## 7. Transcription contract (M02)

Deepgram is called only for selected media with an accessible public media URL
or a locally downloaded file. The planned engine is Nova-3 batch, multilingual,
with smart formatting and word timestamps; diarization is enabled only when
the media is classified as multi-speaker or the request explicitly requires
it.

Transcript record:

```json
{
  "candidateId": "…",
  "status": "complete",
  "provider": "deepgram",
  "model": "nova-3",
  "language": "en",
  "confidence": 0.93,
  "text": "…",
  "segments": [],
  "words": [],
  "source": { "kind": "remote-url", "sha256": "…" }
}
```

Allowed terminal statuses are `complete`, `skipped_no_audio`, `skipped_no_media`,
`failed` and `expired_media`. Text-only Threads posts skip Deepgram. A failed
transcript does not erase the candidate; the Codex analysis must record the
missing evidence.

## 8. Codex analysis contract (M02)

The analysis command creates a local, bounded pack containing only persisted
run data and evidence references. It executes two stages in one Codex session:

### Per-content JSON

Each item analysis contains:

- `summary`, `topic`, `hook`, `structure`;
- `viralMechanisms` with evidence references;
- `commentThemes`, representative comment ids/quotes and audience needs;
- `transcriptInsights` when a transcript exists;
- `adaptationIdeas` for Genius@Content;
- `risks`, `uncertainties`, `confidence` and `evidenceRefs`.

Instagram analysis emphasizes reel hook, transcript and comment patterns.
Threads analysis emphasizes root-post structure, topic framing, reply dynamics,
questions, disagreement and conversation continuation. The model must not
claim visual details absent from the evidence pack.

### Run synthesis

The synthesis contains top recurring topics, hooks, structures, comment
patterns, platform/language differences, rejected/uncertain evidence and
concrete recommendations for Genius@Content. It references candidate ids and
report evidence rather than presenting unsupported generalizations.

## 9. Dashboard contract (M03)

The localhost app exposes read-only Genius@Brains views backed by persisted
records:

- run summary: status, timestamps, credit ledger, variant coverage, errors;
- viral radar: sortable/filterable candidates with score components, metrics,
  language, subtopic, enrichment state and source link;
- content detail: transcript, comments/replies, metrics, score history,
  structured analysis and evidence links;
- trends/report: synthesis report, recurring patterns, platform comparison and
  Genius@Content recommendations.

The server must return empty/partial states as valid JSON, not HTML errors.
External text and URLs are escaped before rendering. The dashboard remains
usable with keyboard navigation and preserves the existing three-module shell.

## 10. Genius@Scale Composio contract (M04)

Settings use Composio's managed connection flow as the primary account path.
The app discovers the current catalogue and displays only toolkits/actions that
expose a supported publishing capability for the target content type. It does
not render an unrestricted list of unrelated toolkits.

Each connection record exposes provider/toolkit, account label, scopes/capability
summary, connection status, last checked timestamp and a redacted external
connection id. Tokens never enter SQLite, reports or browser payloads.

Publishing resolves an action from the discovered capability map and validates
the Genius@Content artefact before execution. The first scope does not silently
fall back to native platform APIs when Composio has no matching action; it marks
the platform/action unavailable and explains the required capability. Existing
publisher contracts and Threads tests must continue to pass.

## 11. Error, security and compatibility rules

- API keys for SocialCrawl and Deepgram are environment-only.
- Provider payloads are treated as untrusted data; URLs are validated and text
  is escaped in Markdown/HTML contexts.
- Budget checks happen before every paid call and are persisted before and after
  the call where possible.
- A single variant failure yields `partial`, not an invented empty success.
- Provider timeouts use bounded retries only when the remaining reserve covers
  the retry; otherwise the call is recorded as failed.
- The old Genius@Brains YouTube source and tests remain untouched until the new
  pipeline has replacement coverage; only generated Genius@Brains artefacts are
  removed in the cleanup step.
- The runtime baseline for the SQLite adapter is Node.js 22.5 or newer; the
  current workspace runtime is already on Node.js 22.

## 12. Acceptance criteria and verification

The scope is accepted only when:

1. A fixture crawl exercises all four variants and never exceeds 100 SocialCrawl
   credits, including retries and enrichment.
2. Duplicate posts collapse to one candidate while retaining all source-query
   evidence.
3. Discovery and final scores expose their component values and respect the
   approved weights and platform/language partitioning.
4. Only selected candidates receive comments/engagement enrichment.
5. Instagram media and eligible Threads videos reach Deepgram; text-only
   Threads posts do not.
6. A partial provider failure produces a usable partial run and visible error
   state without unbounded retries.
7. Codex produces per-item JSON and a cross-run report with evidence references.
8. The localhost dashboard renders all four views from SQLite/filesystem data,
   including an empty run and a partial run.
9. Legacy generated YouTube artefacts are removed only within Genius@Brains;
   unrelated module data is unchanged.
10. Composio settings show only publish-capable discovered actions, connection
    tokens are not exposed, and existing Scale behavior regresses cleanly.

Required checks are the affected workspace typechecks/tests, fixture budget
tests, persistence migration tests, dashboard tests and a manual local smoke
run using mock provider responses. No real paid crawl is required for the
automated suite.

## 13. Explicit exclusions

No automatic scheduler, Universal Search default path, SocialCrawl transcript,
computer-vision interpretation, private-account scraping, autonomous publishing
without an explicit Scale action, cloud deployment, or deletion of existing
Genius@Brains source code is included in this scope.
