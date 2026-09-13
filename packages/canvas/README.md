# Canvas Package

Reusable workspace package extracted from `modules/render-canvas`.

It serves:

- analysis documents from `output/analysis`
- staged source videos from `public/input`
- the split-screen preview UI from `packages/canvas/public`

## Structure

```text
packages/canvas/
  public/
  src/
  package.json
  tsconfig.json
```

## Usage

Run from the repository root:

```bash
npx tsx packages/canvas/src/server.ts
```

Or from the package directory:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4188
```

## Configuration

Optional environment variables:

- `CANVAS_WORKSPACE_ROOT`
- `CANVAS_ANALYSIS_ROOT`
- `CANVAS_VIDEO_ROOT`
- `CANVAS_PORT`

## Development

```bash
npm run --prefix packages/canvas test
npm run --prefix packages/canvas build
```
