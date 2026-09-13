# G@CLight Genius Canvas — UIX Design System

## Direction

G@CLight Genius Canvas is an operator-grade content pipeline cockpit for creators, editors, and operators.

It should not feel like a generic dashboard or a playful SaaS product. The interface should feel like a premium editorial operating system: calm, dense, trustworthy, and production-ready.

Core mental model:

- **Render in the center**
- **Evidence and scene data on the right**
- **Storyboard and timeline as the decision layer**
- **Calendar/publish as a natural pipeline extension**
- **Runs as operational truth and diagnostics**

## Pages in this package

1. `render.html` — main cockpit for vertical preview, scene inspector, timeline, storyboard, and publish summary.
2. `analysis.html` — source video, transcript, shot detection, intelligence, evidence, comments, topic map.
3. `storyboard.html` — narrative planning board, arc view, choreography, asset pack, evidence shots.
4. `calendar.html` — content calendar, Threads publishing, scheduled posts, validation, selected post details.
5. `runs.html` — pipeline runs, diagnostics, health, logs, validation, artifacts, masked secrets.
6. `assets.html` — simple asset inspector placeholder for localPath/publicUrl/altText.

## Palette: Rose Slate

| Token | Hex | Use |
|---|---:|---|
| Paper background | `#F5F3EF` | App background, editorial canvas |
| Elevated panel | `#FBF8F4` | Cards, panels, content surfaces |
| Cool surface | `#F4F7F6` | Secondary surfaces, quiet fills |
| Primary text / ink | `#1F1F23` | Main typography |
| Secondary text / slate | `#57585D` | Metadata, labels, inactive nav |
| Rules / rose ash | `#DCC6CF` | Hairlines, borders |
| Primary accent | `#8F4150` | Active nav, main action, selection |
| Accent wash | `#F2E6EA` | Selected rows/cards |
| Cool teal | `#C7D7D7` | Research, dry-run, secondary utility |
| Olive / success | `#6E8A63` | OK, ready, success |
| Ochre / warning | `#C58A32` | Warning, queued, ready emphasis |
| Critical / wine | `#B84D5A` | Error, failed, destructive state |

## Typography

Recommended production stack:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

For editorial preview headlines:

```css
font-family: Georgia, "Times New Roman", serif;
```

For metadata:

```css
font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
```

Rules:

- Headings: compact, high-contrast, slightly condensed feel.
- Metadata: monospace, small, never loud.
- Body text: clean sans, 12–14px in dense panels.
- Preview headline: editorial serif or condensed display.

## Layout system

Global layout:

```txt
Sidebar 286px | Main workspace flexible
Topbar 58px
Content gap 14px
Panels radius 10px
Controls radius 6px
```

Primary app rhythm:

- Sidebar navigation on the left.
- Sticky topbar with project, title, autosave, share/export.
- Page-specific workspace grid.
- Right inspectors for selected object state.
- Bottom strips for timeline/storyboard/evidence.

## Component rules

### Sidebar

- Brand at top: `G@CLight` + `Genius Canvas`.
- Main nav: Render, Analysis, Storyboard, Calendar, Runs, Assets.
- Active item uses accent wash and accent text.
- Keep workspace/system metadata below nav.
- Palette/system/status cards sit lower and remain compact.

### Panels

- Use thin borders only.
- No heavy shadows except phone preview.
- Border color should be `--rule`.
- Background should be `--surface` with slight translucency where possible.
- Panel titles are small, bold, and functional.

### Status chips

Canonical statuses:

- `draft`
- `ready`
- `dry_run_ok`
- `published`
- `failed`
- `active`
- `success`
- `warning`

Use chips for status clarity but keep them small.

### Phone preview

The preview is the visual anchor.

Rules:

- Centered on Render page.
- 9:16 aspect ratio.
- Split-screen pattern: editorial overlay top, source video bottom.
- Use real production content inside the preview, not abstract placeholders.
- Keep typography inside preview more editorial than app UI.

### Inspector

Right-side inspectors should use rows:

```txt
Label | Value | Action
```

Use the inspector for:

- Hook
- Caption
- Supporting bullets
- Visual type
- Timing
- Source refs
- Google signals
- Firecrawl evidence
- Asset candidates

### Timeline

Use a thin horizontal track with numbered markers.

- Current scene marker uses primary accent.
- Secondary markers remain paper/surface.
- Avoid heavy video editor styling.

### Storyboard

Storyboard cards should include:

- Scene number
- Time range
- Scene type/status
- Hook or caption summary
- Evidence thumbnail
- Visual template

The storyboard is a decision layer, not just a list.

### Analysis

The Analysis page should expose pipeline intelligence:

- Source video
- Transcript
- Shot detection
- Labels / objects / OCR
- Speech insights
- Topic clusters
- Google Video Intelligence
- Firecrawl evidence
- Genius@Brains YouTube comments

Keep it dense but readable.

### Calendar

Calendar is the publishing extension of the pipeline.

Show:

- Month/week/list controls
- Platform and status filters
- Scheduled posts
- Selected post detail
- Asset table
- Latest run artifact
- Validation result
- Publish / dry-run / reschedule controls

### Runs

Runs are operational truth.

Show:

- Run history
- Selected run detail
- Stage progress
- Performance
- Health
- Logs
- Validation
- Artifacts
- Masked secrets/tokens

Never expose full secrets in UI.

## Implementation notes

This package is static HTML/CSS/JS. It is intended as a UIX prototype handoff, not a production app.

Suggested next step for production:

- Convert panels into React components.
- Replace mock data with real endpoints:
  - `/api/analysis-list`
  - `/api/scale-calendar`
  - `/api/runs`
  - `/api/assets`
- Keep CSS tokens as the source of truth.
- Move repeated layout primitives into components:
  - `AppShell`
  - `Sidebar`
  - `Topbar`
  - `Panel`
  - `StatusChip`
  - `SceneCard`
  - `PhonePreview`
  - `InspectorRow`
  - `Timeline`
  - `ArtifactCard`
