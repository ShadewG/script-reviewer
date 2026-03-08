# Script Shield — Future Roadmap

## Backend / Pipeline Improvements

### High Priority
- [x] **Persist video transcripts in DB** — Transcripts stored on reviews table via `videoTranscript` field
- [ ] **Pipeline checkpoint/resume** — If stage 3 (research) fails, the whole run is lost. Save each stage's output as it completes so a retry can pick up from the last successful stage
- [x] **Model fallback chain** — Claude → GPT fallback with shared retry logic in `lib/ai/shared.ts`
- [ ] **Cache research results** — Same case analyzed twice re-queries Perplexity from scratch. Cache by normalized entity names + case state, TTL 7 days
- [ ] **Store video frame thumbnails** — Currently base64 in memory only. Persist to blob storage (R2/S3) or as DB JSONB so report reload shows thumbnails
- [ ] **DMCA / music licensing analysis** — Writers constantly get hit by audio claims. New stage or sub-stage in YouTube Policy that flags background music, clips, and sound effects

### Medium Priority
- [ ] **Stage-level performance logging** — Track duration + token count per stage per review. Store in a `stage_logs` table: `reviewId, stage, model, durationMs, inputTokens, outputTokens, status`
- [ ] **Raise research query limit** — Currently capped at 5 queries. For complex multi-suspect cases this misses context. Make dynamic: 3-8 based on entity count
- [ ] **CourtListener integration improvements** — Currently optional and barely used. Make it a first-class citizen: auto-search by defendant name + state, show docket links in research tab
- [ ] **Prompt versioning** — Track which prompt version produced which results. Store prompt hash per stage on the review. Enables A/B testing prompt changes
- [ ] **Webhook/callback on completion** — Let writers get notified (email, Slack) when analysis finishes instead of watching the progress bar
- [x] **Rate limit handling** — Exponential backoff with jitter via shared retry logic in `lib/ai/shared.ts`
- [ ] **Foreign jurisdiction support** — Currently US-only (50 states + DC). Add UK defamation law (Defamation Act 2013), Canadian law, Australian law as optional jurisdiction

### Lower Priority
- [ ] **Incremental re-analysis** — Writer edits 3 lines → only re-analyze those lines + neighbors instead of full pipeline re-run. Saves cost and time
- [ ] **Confidence scoring on edits** — Each critical/recommended edit should have a confidence score (how certain are we this is actually risky vs overcautious)
- [ ] **Custom policy profiles** — Some channels are more risk-tolerant than others. Let writers save channel-specific thresholds (e.g., "my audience is 25+ so age restriction is less concerning")
- [ ] **Dead letter queue for failed analyses** — Track and surface failed runs with error context so they can be retried or debugged

---

## Frontend / UX Improvements

### High Priority
- [x] **Export to PDF / Print-friendly view** — `@media print` styles + Print/PDF button. Browser Save-as-PDF for export
- [x] **Review history dashboard** — `/reviews` page with filters by verdict + state, sortable table, clickable rows
- [x] **Mobile responsiveness** — Responsive grids, scrollable tabs, stacked layouts on mobile
- [x] **Edit tracking / diff view** — Session-level edit tracking in AnnotatedScriptView with before/after diff, green highlight for edited lines, "Copy All Edits" export
- [x] **Better pipeline progress UI** — Animated progress bars per stage with elapsed time, hardcoded estimates, color-coded status

### Medium Priority
- [ ] **Batch analysis** — Upload 5-10 scripts at once, queue them, show progress dashboard. Useful for series with multiple episodes (needs backend)
- [ ] **Script version comparison** — Upload revised script → show what changed, which flags were resolved, which are new. Side-by-side diff with flag overlay (needs backend)
- [x] **Inline edit mode on annotated script** — Edit flagged lines in-place, AI re-analyzes the change, accept/reject edits
- [x] **Keyboard navigation** — j/k for next/prev, Enter to expand, Esc to close, d to dismiss, ? for shortcuts overlay
- [x] **Flag dismissal with reason** — Accepted risk / Already addressed / False positive / Cleared by counsel. localStorage persistence, cross-tab sync
- [x] **Dark/light theme toggle** — Light mode with CSS vars, localStorage persistence, no flash-of-wrong-theme
- [x] **Print-friendly view** — `@media print` rules hiding interactive elements, expanding sections, white bg

### Lower Priority
- [ ] **Collaboration / comments** — Multiple team members annotate the same report (needs backend)
- [ ] **Shareable report links** — Public read-only link with optional password (needs backend)
- [x] **Tutorial / onboarding** — Guided tour: 3 steps on homepage, 3 steps on results page. Skip/dismiss, localStorage persistence
- [ ] **Notification preferences** — Email digest of recent analyses (needs backend)

---

## Writer-Specific Features

### High Priority
- [ ] **"What changed" summary for re-runs** — Delta summary showing resolved/new flags and risk score change (needs backend: scriptHash/parentReviewId)
- [ ] **Rewrite suggestions quality** — Improve prompts to preserve writer's voice (prompt engineering)
- [x] **Source citation links** — Research tab: person profiles with badges, auto-linked URLs for citations, expandable court records, CourtListener links
- [x] **Quick re-analyze single line** — `/api/analyze-line` wired to AnnotatedScriptView inline edit with AI verdict

### Medium Priority
- [x] **Script templates** — 5 templates: Cold Case, Trial Recap, Missing Person, Serial Killer Profile, Wrongful Conviction. Pre-fills metadata + scaffold text
- [x] **Glossary of legal terms** — 32 terms with click-toggled popovers. Applied to legal flag riskType + reasoning text
- [x] **Risk heatmap on script** — Color-coded lines: red (legal), yellow (policy), darker red (both), green (edited). Minimap sidebar with flag ticks
- [x] **Recommended disclaimer generator** — Context-aware disclaimers based on legal/policy flags, hasMinors, graphic content. Copyable output

### Lower Priority
- [ ] **Competitor content comparison** — Paste a rival channel's video URL → analyze their approach to the same case → show what they did differently (risky vs safe)
- [ ] **Trending case alerts** — Monitor news for cases the writer has analyzed. Alert if new developments change the legal landscape (conviction overturned, new evidence, etc.)
- [ ] **Writer analytics** — Track patterns: "Your scripts average 4.2 legal flags. Most common issue: unattributed allegations. Your risk scores have improved 15% over 3 months"

---

## Infrastructure / DevOps

- [ ] **Error tracking (Sentry)** — No observability right now. Add Sentry for runtime errors, especially model API failures
- [ ] **Database backups** — Automated daily backups of the reviews table
- [ ] **Cost tracking per analysis** — Log API costs per review (token counts × model pricing). Show monthly spend dashboard
- [ ] **CDN for video thumbnails** — If persisting frames, serve via CDN (Cloudflare R2 + Workers)
- [ ] **Automated prompt regression tests** — Run a set of known scripts through the pipeline after prompt changes. Assert that known-risky lines still get flagged, known-safe lines don't

---

*Last updated: 2026-03-08*
