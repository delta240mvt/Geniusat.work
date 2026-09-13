# genius-brains

CLI YouTube comments scraper for `Genius@Brains`.

## Supported commands

- `npm run check:youtube --workspace @genius/brains`
  Validates the API key with a live YouTube Data API request.
- `npm run scrape --workspace @genius/brains -- --job-file ./input/jobs/sample-video.json`
  Loads a job file and writes `job.json`, `videos.json`, `comments.raw.json`, `comments.scored.json`, `comments.md`, and `flow.md`.

## Verification

- `npm test --workspace @genius/brains`
- `npm run typecheck --workspace @genius/brains`

## Layout

- `src/cli/index.ts`: command parsing and orchestration entrypoint
- `tests/cli-smoke.test.ts`: CLI smoke coverage for command wiring
