# Frontend Phase 2 Plan: Discovery + Approval Gate + Run Monitor

> Source of truth for the next frontend phase. Governs work against the backend's new
> `/api/runs/*` run lifecycle. Design contract is [../DESIGN.md](../DESIGN.md); this plan
> applies it, it does not redefine it.

## Status

- **F1 (crawl console): shipped + refactored to per-feature CSS (done).** See
  "F1 CSS refactor" below.
- **Phase 2 (this plan): shipped.** Surfaces S1..S4 below are implemented, along
  with the full Job Spec editor, dataset views, and connection settings.

## Context

Backend Step 2 shipped an approval-gated, LLM-backed discovery service under
`/api/runs/*`:

```
POST /api/runs (JobSpec) -> DISCOVERING -> AWAITING_APPROVAL -> (approve) -> ACQUIRING -> SUCCEEDED
                                                  | (autonomous runs skip the gate)
                                                  +-> FAILED at any breaker/budget trip
```

The run/discovery contract already exists in [../openapi.json](../openapi.json) and the
generated [../src/lib/api-types.ts](../src/lib/api-types.ts), so every screen maps to real
fields. DESIGN.md §1 calls the approval gate "the single most important screen the
platform will ship"; §7 specifies the screen patterns.

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Discovery submit scope | **Build the full `JobSpec` form, but disable all non-core fields.** Only core fields are enabled now; the rest render disabled (visible, greyed, `disabled`) so the full shape is present and progressively enabled later. |
| D2 | Styling convention | **Per-feature CSS files** (co-located `.css` per component, imported at top). Shared primitives live in `src/styles/patterns.css`. **F1 refactored to this now.** |
| D3 | Surfaces | S1 runs list, S2 approval gate, S3 run monitor, S4 discovery submit (full JobSpec, non-core disabled). |

### D1 detail — core vs disabled JobSpec fields

Core (enabled now):
- `name`, `description`, `motivation`
- `discovery.mode` (auto/seeded/fixed), `discovery.seeds`, `discovery.channels`
  (datasets/web/synthesis), `discovery.approval_gate` (default on)
- `target_size.records` / `target_size.tokens`, `verifiability_tier` (1/2/3)
- `limits.max_llm_tokens`, `limits.max_pages_scraped`, `limits.max_cost_usd`

Present but disabled (rendered, `disabled`, greyed, with a "locked for now" hint):
- `intended_uses`, `out_of_scope_uses`, `task_categories`, `languages`, `modality`
- `record_schema_ref`, `allowed_licenses`, `pii_policy`
- `generator_models`, `judge_config`, `generation_params`, `diversity_strategy`
- `dedup_policy`, `decontaminate_against`, `output_format`, `splits`, `output_license`
- `distribution_target`, `maintainer`, `emit_datasheet`

Disabled fields still submit their schema defaults so the payload validates. The full
editor graduates to the `/spec` surface (nav item already stubbed "soon").

## Surfaces (this phase)

| # | Surface | Route | Backs onto |
|---|---|---|---|
| S1 | Runs list (F3 anchor) | /runs | GET /api/runs |
| S2 | Approval gate (F2, signature) | /runs/:runId when awaiting_approval | GET /api/runs/{id}, POST .../approve, POST .../cancel |
| S3 | Run monitor (F3) | /runs/:runId all other statuses | GET /api/runs/{id} (polled), POST .../cancel |
| S4 | Discovery submit (full JobSpec, non-core disabled) | /discovery/new | POST /api/runs |

S2 and S3 share /runs/:runId and branch on `status`: awaiting_approval renders the gate,
everything else the monitor. Mirrors the backend state machine 1:1.

### S1 Runs list
CrawlList shape: active-runs strip (discovering / awaiting_approval / acquiring) above a
dense run table. awaiting_approval rows get a "needs you" affordance. Columns from
RunSummaryOut. Poll 5s. Empty: "No runs yet. Start discovery." -> /discovery/new.

### S2 Approval gate (signature)
Table-first (DESIGN §7). Rows from PlanOut.sources (PlanSourceOut): approve checkbox,
title + locator (mono, middle-truncated), channel pill, aspect_id, score / shape_match /
quality (mono tabular right-aligned), estimated_yield, license_ok / freshness_ok glyphs.
Row expands for reasoning (snippet, notes, discovered_via, license, published). Group by
aspect (PlanOut.aspects / synthesis_aspects: topic, rationale, keywords). Keyboard: j/k
move, a approve, x exclude, Enter expand. Summary bar in --text-metric numerals:
"approved N sources . est yield M records . est tokens/$ X"; cost "unknown" when the
provider gives none. Approve selected -> POST approve (ApprovalRequest); Cancel ->
POST cancel; on success invalidate the run query so the screen transitions to the monitor.

### S3 Run monitor
CrawlDetail two-pane structure. Poll GET /api/runs/{id} at 2s while discovering/acquiring,
stop when terminal. Header (status pill + Cancel when active). Metrics hero numerals
(MetricsOut.pages_scraped, llm_tokens, cost_usd) via the shared .metric primitive.
Budget gauges vs Limits (llm_tokens/pages/cost). Plan panel (approved sources + aspects).
Notes/lineage strip (RunOut.notes). Saturation sparkline per aspect: stub until the
backend streams per-aspect confidence, then wire (flagged, not silently dropped).

### S4 Discovery submit
Single-column form (CrawlSubmit conventions: chip inputs, sections, cost estimate). Full
JobSpec structure; core enabled, non-core disabled per D1. On 202 RunSummaryOut navigate
to /runs/:runId.

## Shared changes (Phase 2 build)

- src/lib/api.ts: add createRun / listRuns / getRun / approveRun / cancelRun; export
  RunSummaryOut, RunOut, PlanOut, PlanSourceOut, PlanAspectOut, JobSpec, ApprovalRequest,
  MetricsOut, Limits from api-types. Reuse the request<T> wrapper + path typing.
- src/components/ui/StatusPill.tsx: extend StatusType with discovering, awaiting_approval,
  acquiring (+ CSS modifiers in StatusPill.css). No new colors; reuse §4.2 tokens.
- src/App.tsx: remove `soon` from discovery + runs nav items; add routes /discovery/new,
  /runs, /runs/:runId. Keep spec/curation stubbed.
- New surfaces: src/surfaces/runs/{RunsList,RunDetail,ApprovalGate,RunMonitor}.tsx and
  src/surfaces/discovery/DiscoverySubmit.tsx, each with a co-located .css.
- New data-viz primitives src/components/viz/ (DESIGN §5): MetricStat, BudgetGauge,
  ScoreBar, Sparkline (each with .css). Note: .metric primitive already lives in
  patterns.css and covers the hero numeral.

## F1 CSS refactor (done this pass)

Converted F1 from inline-style objects to per-feature CSS + shared primitives.

- **Shared:** src/styles/patterns.css (screen-head, panel, data-table, metric,
  callout-error, empty-state, text-muted), imported once via global.css. tokens.css gained
  the DESIGN §4.4 space scale (--space-*) and z-index scale (--z-*).
- **Per-feature CSS** created and wired: Button.css, StatusPill.css, App.css (shell),
  CrawlList.css, CrawlSubmit.css, CrawlDetail.css, PageViewer.css, UsagePanel.css.
- **Cleanup:** removed dead Vite template files (src/index.css, old src/App.css,
  src/assets/*) which carried a banned purple accent and system-ui fonts.
- **Bug fixed:** .table-row-hover (CrawlDetail) and .preset-chip:hover (CrawlSubmit) were
  defined inside CrawlList's injected <style>, so they only worked while the list was
  mounted. Now in patterns.css / CrawlSubmit.css respectively.
- **Contract preserved:** Button keeps the style-prop passthrough and btn-* class names
  global.css hooks; StatusPill keeps its style-prop passthrough. Rendering unchanged.
- **Verified:** npm run build green; npm run lint clean except one pre-existing
  exhaustive-deps warning (CrawlDetail). JS bundle 309.5 -> 292.0 kB; CSS 16.3 -> 33.3 kB.

## CSS conventions (apply to Phase 2)

- One .css per component/surface, co-located, imported at the top of the .tsx.
- Class names kebab-case with a feature prefix; BEM-lite for parts/modifiers
  (block__part, block--modifier).
- Reuse patterns.css primitives before adding feature CSS. Never depend on another
  feature's classes.
- Keep only genuinely dynamic values inline (status colors, computed widths); everything
  static goes to CSS. Use tokens (var(--space-*), colors, radius, motion, z-index), not
  magic values.

## Design-review guardrails (DESIGN.md §8-§10)

Status never color-only (pill + label + glyph). Keyboard-complete approval gate;
focus-visible rings. Numeric columns right-aligned mono tabular-nums; hero numbers use
--text-metric. No card grids outside §5. prefers-reduced-motion handled in global.css.
Both themes first-class.

## Verification

1. npm run dev; nav shows Discovery + Run Monitor active (Phase 2).
2. Backend up (adh serve): POST /api/runs via S4 with approval_gate: true.
3. /runs shows the run; status advances discovering -> awaiting_approval on poll.
4. Approval gate: sources grouped by aspect; j/k/a/x; summary bar recomputes on select;
   approve subset -> acquiring -> monitor.
5. Monitor: metrics hero numerals; budget gauges vs Limits; cost "unknown" when absent;
   terminal status stops polling.
6. Autonomous run (approval_gate: false) skips the gate.
7. cancel from list + detail returns to a terminal state.
8. Error/empty states render per surface (reuse callout-error / empty-state).
9. npm run lint + npm run build clean; regenerate types with npm run gen:api if the
   backend contract moved.
10. Run /design-review as the F2/F3 exit gate.
