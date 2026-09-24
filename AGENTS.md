# Repository rules for agents

These rules apply throughout this repository. User instructions take precedence when they explicitly change a workflow, but a request to commit or push does not turn private data into application code.

## Git contains application material only

Track source code, build and runtime configuration, tests with synthetic fixtures, documentation, and fonts or icons required by the UI. Keep personal recordings, frames, transcripts, prompts, research, generated posts, calendars, analysis packs, databases, exports, logs, account data, keys, and credentials local. The Brains, Content, and Scale `input/`, `output/`, `data/`, `reels/`, and generated `public/` media directories are private even when a file is named `sample` or `.gitkeep`.

Place test data in `tests/` and make it clearly synthetic. Never copy actual user material into tests, examples, documentation, screenshots, or commit messages. A new non-code asset requires content review before staging.

## Before every commit or push

1. Read `git status --short` and inspect the complete staged path list and diff. Stage explicit application paths; do not use `git add -f` or blindly stage the whole workspace.
2. Run `git ls-files -ci --exclude-standard`. It must be empty. If a private file is already tracked, remove it from the index with `git rm --cached` while preserving the local file.
3. Check staged file contents for personal data and secrets, including JSON, Markdown, images and test fixtures. Run `git diff --cached --check`.
4. Before pushing a branch to `main`, inspect the commits in `origin/main..HEAD`, not just the latest commit. Confirm the update is a fast-forward and recheck the remote if it changed.
5. `.gitignore` does not clean historical commits. Report previously published personal data; never force-push or rewrite shared history without a separate explicit request and an impact review. Rotate any exposed real credentials with the provider.

Never delete a user's local data merely to make the Git status clean. See `docs/PRIVATE-DATA.md` for the repository's data locations.
