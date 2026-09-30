# Early warning, reports and the admin console: architecture

This document describes the code as it was shipped (branch `feature/early-warning`). [PLAN.md](PLAN.md) is the approved plan it was built from. The ideas and algorithms come from EWDI v3 (`learn-agents/`, Python/LangGraph); nothing from its stack, domain or look is in this repo.

## 1. The pieces

```
 students                                   admins
 ────────                                   ──────
 "Report a problem" ──► POST /api/reports    /admin console ──► /api/admin/*  (admin JWT, role re-read from DB)
 bell, My reports   ◄── notifications                         ◄── SSE: live investigation, assistant
        │                                                        │
        ▼                                                        ▼
 ┌──────────────┐  triage   ┌───────────────┐   ┌──────────────────────────────────────────┐
 │ reportService│──────────►│ Groq (FAST)   │   │ settingsService  DB > env > default, 30 s │
 │  quota slot  │  embed    │ Gemini embed  │   │ auditService     every admin mutation     │
 └──────┬───────┘──────────►└───────────────┘   └──────────────────────────────────────────┘
        │ Report, ReportEmbedding, ReportTopic
        ▼
 ┌───────────────────────── services/earlyWarning ─────────────────────────┐
 │ features.js  daily metrics per area  ◄── ModelCall (every AI call)      │
 │                                       ◄── GatewayEvent (YouTube, OAuth, │
 │                                            PDF)                         │
 │ scoring.js   pure EWDI port: robust-z, score, levels, escalation,       │
 │              lifecycle         clustering.js: greedy cosine topics      │
 │ scores.js / escalation.js / lifecycle.js ──► RiskScore, RiskAlert,      │
 │                                             RiskObject, RiskPrecedent   │
 │ rescan.js    one idempotent, locked pass (npm run risk:score, Cloud     │
 │              Scheduler, "Rescan now", lazy on the risk board)           │
 │ graph/       LangGraph.js investigation ──► RiskAssessment, RiskStep     │
 │ recommendations.js  catalog, approve/dismiss (same services as console) │
 └─────────────────────────────────────────────────────────────────────────┘
```

## 2. Model layer (every AI feature)

`config/ai.js` holds every model id, the task table (`TASKS`), `route(task, {attempt, confidence, overrides, avoid})`, the daily-quota fail-over chains and `PRICING`. `ai/modelGateway.js` is the one call path:

| Concern | Behaviour |
| --- | --- |
| Logging | One `ModelCall` per attempt: feature, area, student, model, tokens, USD, latency, attempt, outcome (`ok`, `429`, `429_daily`, `5xx`, `invalid_json`, `blocked`, `error`), routedBy, runId/step, conversationId. The feature comes from an AsyncLocalStorage context (`ai/aiContext.js`) set by `aiFeature()` on each AI route, by the graph and by the assistant. |
| Choke points | `ai/groqClient.complete()`, a `ChatGroq` subclass at its `completionWithRetry()` (all LangChain chat: chats, memory summaries, agent, forum, titles) with a callback handler for token counts, `ai/gemini.geminiGenerate()`, plus the new `callJson()`, `transcribe()` and `embedTexts()`. |
| Fail-over | A 429 that waiting will not fix (daily quota, or "try again in" > 30 s) moves to the next model of the tier (`ai.failover` setting). The per-minute "try again in N s" is still waited out by `withRateLimitRetry`, as before. |
| 5xx | Exponential backoff, 3 tries per model (the SDK's own retries are kept for the existing features). |
| JSON | New tasks use Groq `json_object` mode (no strict schema: Groq rejects a whole reply that breaks one), `parseModelJson`, and one retry with "not valid JSON" in context. |
| Final error | `AIUnavailableError` (502, `AI_UNAVAILABLE`), so callers degrade deterministically. |
| Admin switches | `usageGuard.beforeCall()` before every call: provider on, the feature's tool on, and for non-essential features the global daily USD cap (`UsageCounter spend:<day>`). `aiFeature()` also counts the student's daily quota. All off by default. |

## 3. Reports

`POST /api/reports?area=` runs: `toolGate('reports')` → `checkQuotaFirst()` (area from the query string, one indexed count, **before** multer) → multer (screenshot / voice / PDF, disk) → `createReport()`:

1. validate text; refuse voice if `voiceEnabled()` is false; check every file's first bytes (PNG/JPEG/WebP, WebM/Ogg/MP3/M4A/WAV, `%PDF-`) and rename to the real extension;
2. `resolveSource()` copies the AI message it is about from the student's OWN item (notes/doubt/video chats and summaries, agent and coach messages, roadmap, forum comment; quiz questions are verified against the item's strings); otherwise the client's excerpt is kept, marked unverified;
3. route "other" by keywords (`AREA_KEYWORDS`), re-checking that area's quota;
4. insert with the first free `quotaSlot` under the unique partial index `{userId, area, quotaSlot}` where `open: true` (race-free);
5. best effort from here: Whisper transcript, PDF text, `enrichOne()` (the report is already saved; failures are marked for `npm run reports:enrich`), and a background embedding.

`resolveReports()` is the only resolve path (console, bulk, approvals, assistant): one `updateMany` restricted to open/in-progress reports stamps a random `resolveBatchId`; only the reports carrying this call's id are notified, grouped by student, so each student gets exactly one notification and two racing resolves notify once.

## 4. Scoring (EWDI port, `services/earlyWarning/scoring.js`)

Pure functions, constants as parameters (defaults = EWDI's), checked against outputs of EWDI's own Python in `tests/unit/earlyWarningGolden.test.js`.

| Step | Rule | Novard setting |
| --- | --- | --- |
| Window | mean of the last 7 days vs median/MAD of the 21 days before (EWDI: `BASELINE_DAYS = 28` total) | same |
| Daily series | counts: missing day = 0; rates: only on days with enough events | `minDailyReports` 3 (EWDI 15), `minDailyCalls` 20, `minDailyGatewayEvents` 10 |
| Data start | (new) days before the first logged event are missing, not zero | avoids a launch-day spike |
| Robust z | `(v − median) / max(1.4826·MAD, 0.25·|median|, floor)`, clip ±6, signed by `DIRECTIONS` | per-feature `ABS_FLOORS` (EWDI 1e-3 for all) |
| Score | `anomaly_z` = mean of top-3 positive; `score = sigmoid(z − 2)`; attribution = z and share | same |
| Levels | percentiles P85/P95/P99 of observed scores | only after 120 scored windows; never below z 1.5/3/4.5; fixed 0.50/0.82/0.95 before that and for `insufficient_baseline` areas (< 7 active baseline days) |
| Escalation | alert at the start of a HIGH+ episode and on each worsening; latest must still be HIGH+; unique `(area, windowEnd, level)` | same |
| Lifecycle | new → ongoing → escalated (2 rises while alerting, cumulative) → resolved (3 low cycles) → recurring | a cycle is one complete day, applied once (`lastWindowEnd`); non-dominant topics get quiet cycles; the precedent is written once |
| Topics | greedy cosine clustering, τ 0.75 | per area, `minCluster` 3 (EWDI 15), ids kept when a centroid moves < cos 0.9 |

Metrics per area and day: report volume, reporters, unanswered share (48 h grace), p50/p90 time to first reply (log1p hours), mean sentiment, negative / urgent / repeat shares, and the automatic signals AI error rate, AI 429 rate, AI p95 latency, AI answers reported per 1,000 calls and YouTube/PDF failure rate. Slopes: volume, sentiment, unanswered, AI errors.

## 5. The investigation graph (`services/earlyWarning/graph/`)

```
START → buildFeatures → scoreRisk → resolveRiskObject ─(LOW/MEDIUM)→ updateMonitor → END
                                                     └─(HIGH/CRITICAL)→ supervisor
supervisor ─(investigate)→ Send×N → lane ─┐   (temporal, peers, history, semantic, telemetry, in parallel)
           ◄─────────────────────────────┘   fan-in through the append reducers (evidence, lanesDone, runErrors, usage)
supervisor ─(analyze)→ rootCause → verifier ─(revise, ≤1)→ rootCause
                                            ─(need_more_evidence, loop < 3)→ supervisor
                                            ─(else)→ predictor → action → END
```

- **Tracing.** `trace.timed()` wraps every node: a numbered `RiskStep` (latency, summary, cost, error), and every model call inside carries `runId` + `stepSeq`. A node that throws becomes an error step, never a crashed run.
- **Lanes.** Fixed, parameterised queries only (`laneTools.js`); evidence ids `T1.1`, `P1.1`, `H1.1`, `S1.1`, `X1.1`, citing report refs (`NV-…`), model calls (`MC-<id>`) and gateway events (`GW-<id>`). The semantic lane queries with the dominant topic's centroid (no embedding call) via `$vectorSearch`, falling back to `$text`. One short interpretation per lane (≤ 300 tokens), at most `laneConcurrency` at once (per-run semaphore).
- **Root cause.** 1-3 hypotheses and 2-4 recommendations; ids not in the allowed list are removed, then EWDI's rule (keep cited ones; if none is cited, keep all capped at 0.35). No model: a statistical hypothesis citing the lanes' evidence, confidence 0.3, `degraded`.
- **Verifier.** Always routed away from the author's model (`avoid`); Gemini when available. Down → "unaudited" accept.
- **Predictor.** Re-scores perturbed features: backlog resolved, AI errors back to baseline, volume +30%; `p_incident = score ± 0.05` by volume trend (EWDI).
- **Budget.** Checked before every model node (EWDI stored but never enforced it): `risk.budget` defaults 40k tokens / $0.03. Groq's free tier allows ~8k tokens/minute per model; a typical run is 15-30k tokens over two or three models (lanes and supervisor on FAST, root cause on REASONING, verifier on Gemini), so it takes a minute or two with at most one rate-limit wait.
- **Recommendations.** Catalog in `config/earlyWarning.js`. The server decides execution: only `flag_area` is auto; `known_issue_banner`, `set_feature_flag`, `set_model_route`, `bulk_resolve`, `broadcast` wait for approval; approval is claimed atomically and runs `settingsService.set`, `resolveReports` or `broadcast`, all audited.
- **Runs.** `startAssessment()` returns the run id at once; the graph runs in the background; `finish()` stores everything and the exact cost (sum of the run's `ModelCall`s). The live view (`GET …/runs/:id/stream`) polls `RiskStep`/`ModelCall` every 500 ms, so it works on any instance.

## 6. Admin auth, settings and the console

- `POST /api/admin/auth/google`: same Google verification and user upsert as students (`SUPERADMIN_EMAILS` promotion), then `role ∈ {admin, superadmin}` and `status = active`, else 403 `NOT_ADMIN`. Admin JWT: audience `novard-ai-admin`, `ADMIN_JWT_EXPIRES_IN`.
- `requireAdmin()` reads role and status from the DB on every request; `requireSuperadmin()` for role changes; critical settings are superadmin-only in `settingsService.set()`. Last active superadmin: protected in `adminUserService`.
- `requireAuth()` does one indexed read: a suspended account gets 403 `ACCOUNT_SUSPENDED` and the client signs out with the server's message.
- Settings registry in `config/admin.js` (default, validator, group, critical). `settingsService` caches per instance and checks a `__version` document (counter + random stamp) after 30 s. Rate limiters read their limit per request.
- Console (`client/src/pages/admin/`, lazy-loaded): `AdminLayout` composes the app's own `Navigationinner` and `Sidebar` (new optional props only), LearningUI components, the profile cards (`components/profile/blocks.jsx`) and the SVG charts (new `Sparkline`, `ColumnChart`, threshold lines). No dark mode (the app has none).

## 7. Admin assistant (`services/adminAssistant/`)

The Novard Agent's engine (LangChain tool loop, `MongoChatHistory` summary memory, SSE, cards with atomic claiming), its own tools (10 read, 4 mutating that only create cards) and its own collection (`AdminConversation`, sharing the card schema). Replies are not token-streamed because the guards may send an answer back first:

1. refusals (API keys, admin roles, suspensions) answered without a model call, pointing to the console page;
2. per-turn USD cap (`assistant.turnUsdMax`, from this conversation's `ModelCall`s) before each step, `assistant.maxSteps` steps;
3. evidence guard (EWDI): a live-data question answered without a tool is sent back once;
4. numeric check (new): every figure must match a tool number (rounding and percentages allowed); one repair, then a visible "could not be verified" note and `flags.unverifiedNumbers`;
5. at most one card per mutating tool per turn, arguments filtered to an allow-list, results trimmed to 3,500 characters (2,000 stored).

## 8. Operations

| Command | What |
| --- | --- |
| `npm run admin:grant -- --email x --role superadmin` | Create or change an admin (audited as `cli`). |
| `npm run risk:score [-- --full]` | The scoring pass. |
| `npm run reports:enrich` / `reports:embed` | Resumable batch passes (embed also re-clusters topics). |
| `npm run db:vector-index` | Create/update the `report_vec` Atlas Vector Search index. |
| `npm run risk:seed-demo -- --area <id> [--student <email>]` / `-- --clear` | Seed a genuine incident / remove exactly what the demo created. |

Retention: `ModelCall` and `GatewayEvent` expire after 45 days (TTL); `AreaFeature.daily` keeps the daily metrics beyond that.

## 9. Differences from EWDI, and why

| EWDI | Here | Why |
| --- | --- | --- |
| Postgres, pgvector, FastAPI, Gemini-only | MongoDB (Atlas Vector Search, `$text` fallback), Express, Groq + Gemini | Novard's stack |
| Quota: lifetime count, non-atomic | open reports only, atomic slot | students can report again once helped; no race |
| Second resolve path without notification | one `resolveReports()` | exactly one notification per student |
| Budget never enforced | enforced before every model call | Groq's per-minute token limit |
| Cited ids not checked | removed unless offered | no invented citations |
| Verifier could equal the author after a retry | `avoid` in `route()` | independent review |
| Precedent re-written every low cycle | once, on the transition | clean history |
| Lifecycle only in graph runs; old topics never resolve | every scoring pass, quiet cycles for non-dominant topics | risks close |
| Copilot mutations run immediately; spend not logged | confirmation cards; every call logged | admin control, cost visibility |
| No numeric check | figures must match tool results | trustworthy answers |
| Uncited cap only when all uncited (kept) | kept, faithfully | the code was the source of truth |
