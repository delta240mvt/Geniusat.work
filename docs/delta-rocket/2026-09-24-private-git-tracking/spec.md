# Specification: private Git tracking

## M1: tracked content and ignore behavior

1. The tip committed to both refs contains application source, runtime/build configuration, tests, reviewed synthetic test fixtures if necessary, documentation and agent rules, and UI-required fonts/icons. No personal recordings, frames, scripts, research, social content, database, credential, generated output, or mock dataset remains tracked.
2. All `apps/*/input/`, `apps/*/output/`, `apps/*/reels/`, and `apps/*/public/input/` contents are ignored without file exceptions. Existing `.gitkeep` and sample JSONs in these paths leave the index but remain on the local filesystem. Content AI Studio and generated preview paths remain ignored. UIX mock data and generated reel comparison images/measurements are ignored and untracked.
3. Tests that previously loaded tracked sample JSONs create synthetic input inside a temporary directory; they pass from a checkout without those sample files. Documentation refers to user-created local input paths, not bundled private-path examples.
4. Root `AGENTS.md` instructs agents to classify new files before staging, keep user data local, avoid `git add -f`, run a tracked-file audit before commit/push, never push ignored files, and treat history exposure separately. Existing module instructions must not contradict it.
5. `.gitignore` is prospective only. Audit the paths and contents in `origin/main..HEAD` and the prior reachable history for personal files, including the already-published `reels-safezone/source.jpg`. Do not force push or rewrite history under this scope. Clearly report any already-published data that remain in historical commits; pushing a clean tip to `main` does not erase their exposure.
6. Before commit, `git ls-files -ci --exclude-standard` is empty and a path-based audit shows no personal data tracked. Review the content of every retained non-code file introduced or changed in this scope. `git check-ignore` confirms representative Brains, Content, Scale, UIX and generated reel paths. `git diff --cached --check` succeeds. A working tree check confirms local data files still exist.
7. Required affected tests pass. The feature branch and `main` pushes are fast-forward and point to the same audited commit. If remote `main` advances, fetch and re-evaluate before pushing.

No live crawl, transcription, render, publication, credential rotation, or remote history rewrite is part of this change.
