# Viral Intelligence Revolution — state

Status: complete
Started: 2026-09-20
Branch: baza200926-socialcrawl

## Implementation checkpoint

- Approval: explicit user approval received on 2026-09-20 — “Działaj dalej autonomicznie. Używaj todo listy, odhaczaj zadania i trzymaj się ustalonego przepływu pracy”.
- Starting revision: `68c23df607646f5053b0dfeec25cf0601ae5c134`.
- Starting tree: no pre-existing tracked or unstaged application changes. The only untracked files are this scope's `plan.md`, `spec.md` and `state.md`; they are preserved in place as the recoverable scope record.
- Relevant starting inventory: `apps/genius-brains/`, `apps/genius-content/`, `apps/genius-scale/`, `packages/canvas/`, root workspace configuration and tests.

## Implementation todo

- [x] M00 — Freeze shared contracts, budget ledger and persistence foundation. Contract and SQLite tests green; `@genius/brains` typecheck green.
- [x] M01 — Implement direct SocialCrawl discovery, dedupe, local viral ranking and guarded enrichment. Integration fixes and budget hard-stop checks are complete.
- [x] M02 — Implement Deepgram eligibility/transcription and Codex analysis/report contracts. Missing-key recording and structured pack checks are complete.
- [x] M03 — Implement SQLite/filesystem history and Genius@Brains localhost dashboard. Dashboard API, transcript view and read-model integration checks are complete.
- [x] M04 — Implement Composio capability discovery, managed connections and Scale publishing adapter. Runtime catalogue filtering, Connect Links, CLI adapter and settings surface are complete.
- [x] R1 — Review each completed module once and resolve findings. M01–M04 reviews completed inline; fixes: provider paths remain relative, reserve-safe budget commits, Threads image/video classification, conditional diarization, Codex run/candidate matching, full dashboard history, selectable single-content analysis, surfaced corrupt artefacts, Composio auth-config discovery, bounded catalogue failures, and redacted execute responses.
- [x] R2 — Final whole-implementation review round 1 completed inline; corrected Composio tool-catalogue pagination and rechecked secret boundaries. Independent reviewer unavailable.
- [x] R3 — Final whole-implementation review round 2 completed inline; no further findings. Independent reviewer unavailable.
- [x] V — Final verification, project history entry and delivery.

## Review counters

- Plan review: attempt 1 completed inline; independent reviewer unavailable. Findings corrected: dependency order and Genius@Brains-only cleanup boundary.
- Spec review: attempt 1 completed inline; independent reviewer unavailable. Findings corrected: relevance threshold, crawl/analysis statuses and budget-derived candidate cap.
- Module reviews: 4 (M01–M04 completed inline; independent reviewer unavailable)
- Final implementation reviews: 2 (round 1 and round 2 completed inline; independent reviewer unavailable)

## Agreed decisions

- The application remains one localhost app with three modules: Genius@Brains, Genius@Content and Genius@Scale.
- Control is through the terminal/Codex; the localhost app provides the dashboard and previews.
- Old YouTube artefacts are to be removed only from Genius@Brains. Existing Genius@Brains source code is retained until the replacement design is accepted.
- Genius@Brains becomes the viral-content intelligence module for Instagram and Threads, using SocialCrawl for discovery and Deepgram for transcription.
- Genius@Scale uses Composio as the primary account-connection and publishing path.
- The Scale settings should expose only social/content platforms with a real Composio publishing action, discovered from the Composio catalogue rather than listing unrelated toolkits.
- Viral selection uses a hybrid score: relative performance within the platform and niche, plus minimum reach/engagement and freshness thresholds.
- The first discovery radar covers English and Polish content, with language-aware comparison rather than one mixed ranking.
- Deepgram is planned as the Nova-3 batch transcription engine in multilingual mode, with word timestamps and formatting; diarization is conditional on multi-speaker media.
- Deep analysis focuses on discovery metrics, transcripts and comments; no automated visual/audio/video understanding is required. The dashboard should preserve the original reel/thread link for manual viewing.
- The analysis output must be structured and persisted so the localhost dashboard can present every finding, not only terminal text.
- The first radar covers both Instagram and Threads. Analysis is performed by a Codex session over a local, structured analysis pack.
- Threads requires platform-specific analysis of the root post, its structure/topic and the visible reply dynamics, rather than being treated as an Instagram-like media item.
- Threads findings are analyzed as full available threads: root post plus available replies and conversation dynamics.
- The radar is manual: a terminal/Codex command starts each crawl; no automatic scheduler runs SocialCrawl or analysis.
- The AI niche is configuration-driven, with editable subtopics and bilingual discovery queries rather than hardcoded topic logic.
- The recommended storage foundation is local SQLite for indexed runs/findings plus filesystem artefacts for raw payloads, transcripts and reports.
- Universal Search is not the default discovery engine: it costs 20 credits per call and does not guarantee viral-only results.
- Discovery uses direct low-cost SocialCrawl searches in four variants: Instagram EN, Instagram PL, Threads EN and Threads PL.
- Each discovery result is deduplicated and ranked locally with a platform-aware viral score before any deeper enrichment.
- The baseline viral score weights engagement velocity at 40%, comment/reply quality and volume at 25%, relative views/reach at 20%, likes/reposts at 10%, and freshness/topic fit at 5%; scoring is relative to platform, language and sub-niche so large accounts do not win automatically.
- Only the top 10–20% of candidates from each discovery variant move to paid enrichment.
- Engagement/comment enrichment is fetched only for the highest-ranked candidates; Deepgram and Codex analysis are outside this SocialCrawl budget.
- The full test crawl has a hard 100-credit SocialCrawl cap, including discovery, engagement and comments. The working allocation is 30 credits for four-variant discovery, 50 for Instagram comments on top candidates, 10 for Threads comments/views enrichment, and 10 held as a safety reserve for pagination, retries or additional engagement.
- The Genius@Brains dashboard baseline has four views: run summary, viral radar, single-content analysis, and cross-run trends/report with recommendations for Genius@Content.
- Deepgram eligibility is platform-aware: selected Instagram Reels are transcribed; text-only Threads posts are analyzed from post text and replies; Threads video posts are transcribed only when a public media URL is available. SocialCrawl transcripts remain disabled.
- Codex analysis runs in one manual session after a crawl: first structured per-content analyses, then a cross-run synthesis report with patterns and Genius@Content recommendations.
- All crawl payloads, comments, transcripts, item analyses, rankings and run reports are retained locally; SQLite indexes the history and the filesystem stores raw/large artefacts.

## Implementation checkpoint

- Plan and specification reviewed and aligned.
- Implementation approval: explicit user approval received; execution resumed autonomously.
- Final verification evidence: `npm test --workspace @genius/brains` (16 files, 52 tests passed); `npm run typecheck --workspace @genius/brains` passed; `npm run typecheck --workspace @genius/scale` passed; `npm test --workspace @genius/scale` (5 files, 64 tests passed); `npm run build --workspace @genius/canvas` passed; `npm test --workspace @genius/canvas` (42 tests passed); `git diff --check` passed.
- Final review 2 finding disposition: no material findings; secret boundary, Composio catalogue filtering/pagination, budget hard-stop, dashboard read-model and affected test suites rechecked inline. Independent reviewer unavailable.
