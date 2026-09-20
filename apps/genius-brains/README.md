# genius-brains

`Genius@Brains` is the local viral-intelligence CLI for Instagram and Threads.
It discovers cheaply through direct SocialCrawl endpoints, ranks locally,
enriches only the top candidates with comments/engagement, transcribes eligible
media with Deepgram and prepares one structured pack for a Codex analysis
session. SQLite and filesystem artefacts retain the complete local history.

## Supported commands

- `npm run check:youtube --workspace @genius/brains`
  Validates the API key with a live YouTube Data API request.
- `npm run scrape --workspace @genius/brains -- --job-file ./input/jobs/sample-video.json`
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

## Verification

- `npm test --workspace @genius/brains`
- `npm run typecheck --workspace @genius/brains`

## Layout

- `src/cli/index.ts`: command parsing and orchestration entrypoint
- `tests/cli-smoke.test.ts`: CLI smoke coverage for command wiring
