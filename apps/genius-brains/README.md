# genius-brains

`Genius@Brains` is the local viral-intelligence CLI for Instagram and Threads, with a separate LinkedIn research crawl.
It discovers cheaply through direct SocialCrawl endpoints, ranks locally,
enriches only the top candidates with comments/engagement, transcribes eligible
media with Deepgram and prepares one structured pack for a Codex analysis
session. SQLite and filesystem artefacts retain the complete local history.

## Supported commands

- `npm run check:youtube --workspace @genius/brains`
  Validates the API key with a live YouTube Data API request.
- `npm run scrape --workspace @genius/brains -- --job-file ./input/jobs/<your-local-job>.json`
  Loads a job file and writes `job.json`, `videos.json`, `comments.raw.json`, `comments.scored.json`, `comments.md`, and `flow.md`.

## Viral intelligence

Set `SOCIALCRAWL_API_KEY` and run a manual crawl (the config is optional):

```bash
npm run genius:brains -- crawl --config ./input/viral-intelligence.json
```

Then prepare the Deepgram transcript and Codex pack:

```bash
npm run genius:brains -- analyze --run-id <run-id>
npm run genius:brains -- analyze --run-id <run-id> --codex-output <codex-output.json>
```

The full SocialCrawl budget is hard-capped at 100 credits by the validated
config contract. `DEEPGRAM_API_KEY` is optional for pack preparation; without
it, eligible media is recorded as unavailable instead of silently skipped.

## LinkedIn research controlled by Codex

Ask Codex to create a local JSON config under the ignored `input/` directory, then run:

```bash
npm run genius:brains -- linkedin-crawl --config ./apps/genius-brains/input/linkedin-research.json
npm run genius:brains -- analyze --run-id <linkedin-run-id>
npm run genius:brains -- analyze --run-id <linkedin-run-id> --codex-output <codex-output.json>
```

`analysisFocus` is the question or pattern to investigate. Each `searches` entry can specify a query, reporting language, recent-date filter, content type, numeric company ID or member URN, sort order and page limit. SocialCrawl has no LinkedIn search language filter here: write the query in the desired language; `language` only labels the results. Global `filters` support minimum likes/comments and included/excluded words. Codex can change these per run without changing code. The validated budget remains 100 SocialCrawl credits: 60 for search, 30 for comments on top posts and 10 reserved by default. The crawler uses the 5-credit page endpoint, not the variable-price bulk `limit` mode or paid extra labels. Search coverage is best-effort for public indexed posts, not a complete LinkedIn archive. No paid API call occurs until `linkedin-crawl` is invoked.

LinkedIn results and criteria are saved with the same SQLite/artefact history read by the Brains dashboard. Analysis packs include the research focus and comments; LinkedIn media is not sent to Deepgram automatically.

## Verification

- `npm test --workspace @genius/brains`
- `npm run typecheck --workspace @genius/brains`

## Layout

- `src/cli/index.ts`: command parsing and orchestration entrypoint
- `tests/cli-smoke.test.ts`: CLI smoke coverage for command wiring
