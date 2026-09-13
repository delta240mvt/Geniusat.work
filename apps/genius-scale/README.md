# Genius@Scale

Genius@Scale prepares and checks project content before publishing it to social platforms.

## Sample Inputs

- Project config: `apps/genius-scale/input/projects/sample-project.json`
- Content input: `apps/genius-scale/input/content/sample-thread.json`

The sample project keeps the Threads access token out of JSON by naming the environment variable in `platforms.threads.accessTokenEnv`.

## Dry Run

Run the sample through local validation without publishing:

```bash
npm run dry-run --workspace @genius/scale -- -- --project-file input/projects/sample-project.json --content-file input/content/sample-thread.json
```

Use `--output-root <path>` to write artifacts somewhere other than `apps/genius-scale/output`.

Dry-run accepts local-only media assets and writes diagnostics for missing `publicUrl` values. Real Threads publishing requires every image or video asset to have a publicly reachable `publicUrl`; `localPath` is only for local preview and operator context.

## Publish

The bundled sample is intentionally dry-run-only. Before using it for a real Threads publish, edit `input/projects/sample-project.json` to replace `THREADS_USER_ID_PLACEHOLDER`, set `THREADS_ACCESS_TOKEN` in your environment, and provide a public URL for every media asset in `input/content/sample-thread.json`.

Publish one prepared item by id after the project and media URLs are ready:

```bash
npm run publish --workspace @genius/scale -- -- --item gaclight-sample-thread --project-file input/projects/sample-project.json --content-file input/content/sample-thread.json
```

`THREADS_USER_ID` is included in `.env.example` as an operator placeholder for local environment setup, but the current sample project JSON contains the actual `threadsUserId` field value to replace before publishing.

## Calendar Artifact

Regenerate the calendar artifact directly:

```bash
npm run calendar --workspace @genius/scale -- -- --project-file input/projects/sample-project.json --content-file input/content/sample-thread.json
```

The canvas calendar JSON is written to:

```text
apps/genius-scale/output/calendar.json
```

When `--output-root <path>` is provided, the calendar is written to `<path>/calendar.json`.
