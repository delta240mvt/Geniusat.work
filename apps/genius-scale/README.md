# Genius@Scale

Genius@Scale prepares and checks project content before publishing it to social platforms.

## Composio connections and publishing

Composio is the primary connection path for supported publishing actions. The
catalogue is discovered at runtime and filtered to social/content publishing
capabilities; unrelated toolkits are not shown. Keep `COMPOSIO_API_KEY` and
optionally `COMPOSIO_USER_ID` in the local process environment.

```bash
npm run genius:scale -- composio:capabilities
npm run genius:scale -- composio:connections
npm run genius:scale -- composio:connect --auth-config-id <id> --alias main
```

Publish a prepared item through an explicitly selected discovered action and
connection:

```bash
npm run publish --workspace @genius/scale -- --item <id> --project-file input/projects/sample-project.json --content-file input/content/sample-thread.json --provider composio --action-slug <ACTION_SLUG> --connection-id <ca_...>
```

The adapter validates the item status and required action inputs, stores a
redacted run artifact, and never falls back silently to a native API.

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
