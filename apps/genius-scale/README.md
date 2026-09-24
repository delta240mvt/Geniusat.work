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
npm run publish --workspace @genius/scale -- --item <id> --project-file input/projects/<your-project>.json --content-file input/content/<your-content>.json --provider composio --action-slug <ACTION_SLUG> --connection-id <ca_...>
```

The adapter validates the item status and required action inputs, stores a
redacted run artifact, and never falls back silently to a native API.

## Local inputs

- Project config: create `apps/genius-scale/input/projects/<your-project>.json`
- Content input: create `apps/genius-scale/input/content/<your-content>.json`

Keep the Threads access token out of JSON by naming its environment variable in `platforms.threads.accessTokenEnv`. All files under `input/` stay local and are not included in Git.

## Dry Run

Run local input through validation without publishing:

```bash
npm run dry-run --workspace @genius/scale -- -- --project-file input/projects/<your-project>.json --content-file input/content/<your-content>.json
```

Use `--output-root <path>` to write artifacts somewhere other than `apps/genius-scale/output`.

Dry-run accepts local-only media assets and writes diagnostics for missing `publicUrl` values. Real Threads publishing requires every image or video asset to have a publicly reachable `publicUrl`; `localPath` is only for local preview and operator context.

## Publish

Before publishing to Threads, set `THREADS_ACCESS_TOKEN` in your environment, provide the actual Threads user ID in your local project file, and provide a public URL for every media asset in your local content file.

Publish one prepared item by id after the project and media URLs are ready:

```bash
npm run publish --workspace @genius/scale -- -- --item <your-item-id> --project-file input/projects/<your-project>.json --content-file input/content/<your-content>.json
```

`THREADS_USER_ID` is included in `.env.example` as an operator placeholder for local environment setup.

## Calendar Artifact

Regenerate the calendar artifact directly:

```bash
npm run calendar --workspace @genius/scale -- -- --project-file input/projects/<your-project>.json --content-file input/content/<your-content>.json
```

The canvas calendar JSON is written to:

```text
apps/genius-scale/output/calendar.json
```

When `--output-root <path>` is provided, the calendar is written to `<path>/calendar.json`.
