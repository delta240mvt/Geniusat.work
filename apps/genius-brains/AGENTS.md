# AGENTS.md

## Scope

These instructions apply to all work under `apps/genius-brains`.

## Mission

`genius-brains` is a local CLI for `Genius@Brains` that:

- validates YouTube API access,
- resolves a single video or a channel into target videos,
- fetches top-level YouTube comments,
- ranks comments by engagement,
- writes deterministic JSON plus optional Markdown and flow artifacts.

Keep the module focused on comment intelligence for downstream analysis. Do not turn it into a generic YouTube downloader, transcript tool, or UI app unless the task explicitly requires that change.

## Operating mode

After reading this `AGENTS.md`, the agent should wait for YouTube links from the user.

Default interaction model:

- user sends one or more YouTube links,
- agent prepares or updates job inputs,
- agent runs the local scrape pipeline,
- agent returns the generated output paths and any blocking errors.

Do not ask for extra planning when the user is simply sending links for processing.

## Current entrypoints

- `npm run check:youtube --workspace @genius/brains`
- `npm run scrape --workspace @genius/brains -- --job-file ./input/jobs/sample-video.json`
- `npm test --workspace @genius/brains`
- `npm run typecheck --workspace @genius/brains`

CLI entrypoint:

- `src/cli/index.ts`

## Source contract

Jobs are loaded from JSON files and validated through `src/config/schema.ts`.

Supported sources:

- `source.type = "video"` with `videoId` or `videoUrl`
- `source.type = "channel"` with `channelUrl`

Current default behavior:

- `selection.channelCandidateLimit = 50`
- `selection.channelSelectedVideosLimit = 5`
- `selection.commentFetchLimit = 200`
- `selection.topCommentsLimit = 100`
- `selection.excludeLive = true`
- `selection.excludeShorts = true`
- `selection.videoSort = "viewCount"`
- `ranking.likesWeight = 1`
- `ranking.repliesWeight = 3`
- `output.writeRawJson = true`
- `output.writeMarkdown = true`
- `output.writeFlow = true`

When changing schema defaults or output shape, update tests and sample jobs in the same change.

## Output contract

`scrape` writes per-video output into `apps/genius-brains/output/<video-slug>/`.

There is also a shared export directory:

- `apps/genius-brains/output/ALL COMMENTS/`

Expected artifacts:

- `job.json`
- `videos.json`
- `comments.raw.json` when `writeRawJson = true`
- `comments.scored.json`
- `comments.md` when `writeMarkdown = true`
- `flow.md` when `writeFlow = true`

Shared Markdown export:

- `ALL COMMENTS/<video-slug>.md`

Preserve these guarantees unless the task explicitly changes the contract:

- JSON output is deterministic.
- `comments.scored.json` is the main downstream artifact.
- each video gets its own slug folder based on the YouTube title,
- `comments.md` stays as the fixed filename inside the per-video folder,
- files inside `ALL COMMENTS` use the slug as the Markdown filename,
- `whySelected` should stay short and readable.
- Ranking order is deterministic for ties.
- Failures on one video should be captured as artifacts, not crash the whole channel run unless the root input is invalid.

## Implementation rules

- Prefer extending existing modules under `src/config`, `src/youtube`, `src/ranking`, `src/export`, and `src/utils` instead of adding ad hoc logic in `src/cli/index.ts`.
- Keep ranking logic pure and testable.
- Keep export code deterministic and filesystem-only.
- Keep YouTube API code isolated behind the client/fetch helpers.
- Avoid hidden behavior driven by ambient state beyond documented env vars and CLI args.

## Verification rules

For code changes in this module, run:

- `npm test --workspace @genius/brains`
- `npm run typecheck --workspace @genius/brains`

If you change CLI behavior, schema, ranking, or artifact format, add or update tests first.

## Non-goals

- No browser UI in this module.
- No direct mutation of files outside `apps/genius-brains/input` and `apps/genius-brains/output` unless the task explicitly requires it.
- No silent breaking changes to artifact names or folder layout.
