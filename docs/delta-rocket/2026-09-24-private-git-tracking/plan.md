# Plan: private data outside Git

Start: 2026-09-24. Scope: keep application source and reviewed synthetic test material versioned while excluding local Genius@Brains, Genius@Content and Genius@Scale data. Publish the resulting fast-forward commit to the current branch and `main`.

## M1 — Repository privacy boundary

- Audit tracked files, generated paths, and the full `origin/main..HEAD` range that the push will make reachable from `main`. Keep existing local files intact when removing them from Git's index.
- Tighten root `.gitignore` around app inputs, outputs, local databases, recordings, exports, private research, generated reel images, and local configuration. Do not add exceptions inside private app input/output paths.
- Move only required synthetic test inputs into test fixtures, adjust tests and documentation, and remove tracked copies in private paths. Keep application code, configuration schema, dependencies, fonts, and icons.
- Add root `AGENTS.md` guidance for all agents and align the Brains-specific instructions with the privacy boundary. Update privacy documentation.
- Verify fresh-clone tests, tracked-file/ignore audits, and no personal media or database files in the new commit. Confirm the branch is a fast-forward of `origin/main`; push both refs without rewriting history.

Allowlisted repository material is application source, build/runtime configuration, tests and reviewed synthetic fixtures, documentation and agent rules, plus fonts/icons required by the UI. Exclude user inputs, generated outputs, databases, secrets, UIX mock data and generated design screenshots/measurements. Review any new non-code asset before tracking it.

Historical commits already published to GitHub are outside this commit's boundary. Report any historical personal files and the need for separate history cleaning without a force push.
