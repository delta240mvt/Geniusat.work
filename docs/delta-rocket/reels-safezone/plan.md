# Plan: three safe-zone reel concepts
2026-09-13. User requested three rendered alternatives before choosing the permanent visual direction.
M1: shared full-frame video and safe-zone overlay renderer with three selectable motion concepts (interface, metaphor, transformation). Preserve source clips, captions, engine and existing exports. Add optional motionConcept setting explicitly set on comparison projects; absent retains legacy rendering pending selection; existing style remains compatible. Create three separate reel projects from delta-modele-ai (16.6 seconds) for direct comparison. No publishing or source deletion.
Files: apps/genius-content/src/reels/model.ts, visual.ts, safe-visual.ts, focused tests, comparison generation script, documentation. Existing files.ts/render.ts are reused.
Verify: content build/tests; browser geometry across scene transitions, long titles and caption pages; render/decode all three MP4s; visually inspect representative frames.
