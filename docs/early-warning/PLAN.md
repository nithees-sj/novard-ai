# Novard-AI Early Warning: user reports, risk scoring, admin console

> Plan mode only lets me write this file. **The first step after approval is to copy it, unchanged, to `docs/early-warning/PLAN.md`.** It follows the section list you asked for: context, concept mapping, data model, permissions, files, phases and open questions.

## Context

Novard-AI currently has no way for students to report problems, no way to see that a feature is going wrong, and no admin role at all. The `User` model is `{name, email, picture, mobile, bio}`; the JWT carries only `sub=email` and `name`.

EWDI (learn-agents) solves the same problem for an e-commerce shop:
1. Tickets are counted per department.
2. Counts become robust anomaly scores.
3. Escalations raise one alert per episode.
4. A LangGraph investigation explains the cause, citing evidence.
5. Staff resolve tickets and customers are notified.

This plan ports EWDI's **algorithms and ideas** (not its code, stack or look) into Novard's MERN stack. It adds three things:
- student **reports**;
- per-**app-area** early-warning risk;
- an **admin login and console**, built from Novard's own components.

Everything is JavaScript/JSX, MongoDB and Novard conventions: routes → controllers → services, `HttpError`, `utils/validate.js`, `asyncHandler`, and `useTestDatabase()` tests.

Git: work on a new branch **`feature/early-warning`** created from `feature/agent-requirements` (your choice). Before branching, if the 8 uncommitted files are still uncommitted, I commit them unchanged on `feature/agent-requirements` as a separate commit ("WIP: pending learning-view tweaks, committed as-is"). After that, one commit per phase. I never push.

---

## 1. What I found that changes the brief

These come from reading the code, and each one changes the design.

| Brief assumes | Code reality | Consequence |
|---|---|---|
| Agent has `propose_*`/`do` tools and command recognition | This branch uses `prepare_*` → editable **draft card** → student presses Create (`agent/novardAgent.js:339-396`, `agent/conversations.js:119-152`). There are no slash commands. | `report_problem` becomes a new entry in `ACTIONS` (`agent/actions.js`), with `prepare_report_problem`, a draft card, then Create → `reportService.createReport`. |
| A shared layout shell exists | Each page renders `<Navigationinner/>` + `<Sidebar/>` + `ml-64` itself. There is no mobile drawer except inside `Chatbot.jsx`. | Add a thin `AdminLayout` that composes the **same** `Navigationinner` and `Sidebar`, and extend `Sidebar` with optional props (below). Student pages are unchanged. |
| Mobile drawer "like the student app's" | The student shell has none. You declined turning it into a drawer on 2026-09-26. | `Sidebar` gets an **opt-in** `drawer` prop, used only by `AdminLayout`, copying Chatbot's drawer pattern (`md:hidden` backdrop). Student pages don't pass it, so nothing changes for them. |
| Dark mode | None (`dark:` is used 0 times). | The console has no dark mode, matching the app. |
| AI messages have ids | Chat messages are keyed by array index. Notes, doubts and videos have subdoc `_id`s that the client strips. Agent and skill-gap messages use `_id:false`. Forum AI comments are top-level docs. | A report stores a **locator** `{itemType, itemId, messageIndex, messageId?}`. The server copies the message text into `source.excerpt` itself, after checking the student owns the item. Client-sent text is only used when the locator can't be resolved, and is marked `excerptVerified:false`. |
| Forum "delete a reply", "hide AI reply" | Only the owner-only `deleteIssue` exists. There is no comment delete and no hidden flag. | `deleteIssue` gets an `{asAdmin}` option. Add `deleteComment` and a `hidden` field on `ForumComment`; `listComments` filters hidden comments out. |
| Model-call logging hooks | Token usage is discarded (`complete()` returns a string; LangChain goes through `StringOutputParser`). No call site knows its user or feature. | There are three choke points: `ai/groqClient.complete`, `ai/conversation.chatModel` (via a LangChain callback handler) and `ai/gemini.geminiGenerate`. User and feature come from an **AsyncLocalStorage** context set by per-route middleware. No service signatures change. |
| userId | Every collection keys the user by **email** (`req.user.email`). | Reports, notifications, audit and so on store `userId`/`adminId` as email, matching the rest of the app. `/api/admin/users/:id` uses `User._id`. |
| Upload helpers in `utils/` | Multer is configured in `notesController.js`; `utils/uploads.js` has `hasSignature`, `uploadDir` and `removeUpload`. | The new report upload reuses `uploads.js` helpers and gets its own multer instance in `reportController.js`, following the notes pattern. |

### EWDI code vs the brief

Where they disagree, I follow the code for the algorithm and the brief for the Novard fit.

| Topic | EWDI code | Decision |
|---|---|---|
| Baseline | `base_lo = window_end−28d`, `base_hi = win_lo−1` → **21-day** pre-window baseline (`features/compute.py:118-121`), not 28 | Port the code: 7-day window plus 21-day baseline, inside a 28-day span. |
| Uncited hypotheses | If some hypotheses are cited, uncited ones are **dropped**. Only when *all* are uncited are they kept, capped at 0.35 (`agents.py:317-323`). | Port the code, plus: cited ids are checked against the allowed id set (EWDI doesn't), and hallucinated ids are removed first. Capped hypotheses get `uncited:true`. |
| Budget | $0.25/60k is stored but **never enforced**: state budget is never decremented and tokens are never checked. | Enforce it for real (§6.4). |
| Precedent | Re-inserted on **every** low cycle after resolve (a bug) | Write it only on the transition into `resolved`. |
| Lifecycle | Runs only inside graph invocations; `rise_streak` is **cumulative** while alerting | Keep the cumulative streak (faithful). Run lifecycle in every scoring pass (so "cycles" mean something), and make it idempotent per `windowEnd`. |
| Escalation | Alert at episode start **plus** each worsening (HIGH→CRITICAL), only if still ≥HIGH | Port as-is. |
| Quota | Lifetime count, all statuses, non-atomic count-then-insert | Count **open/in-progress** reports (brief). Make it atomic with a slot index (§4). |
| Verifier ≠ author | Violated after a root_cause retry (both end up on `flash-lite-latest`) | `route()` enforces that the verifier model differs from the model root_cause actually used. |
| Copilot mutations | Never confirmed. At-most-once is per tool. Numbers are not checked. Copilot spend is not in `model_calls`. | Use confirmation cards. Keep at-most-once per tool. Add a real numeric check. Log all assistant calls to `ModelCall`. |
| Trim | Observations cut at 3,500 chars, logs at 2,000 | Port both. |
| Live view | SSE that polls `steps` every 0.5 s | Same idea (it works across Cloud Run instances). |

---

## 2. Concept mapping (checked against the code)

| EWDI (code) | Novard-AI |
|---|---|
| `users.role=admin` | `User.role`: `student`, `admin` or `superadmin`, plus `User.status`: `active` or `suspended` |
| Department entity | **Area** (id immutable, label editable): `sign-in`, `notes`, `video-summarizer`, `video-library`, `doubts`, `quizzes`, `skill-unlocker`, `roadmap`, `skill-gap`, `forum`, `agent`, `dashboard`, `other`. Defaults live in `config/earlyWarning.js`; the live list is the `reports.areas` setting, and admins can rename, add, or merge (`mergedInto`). |
| Ticket `CX-XXXXXXXX` | Report `NV-XXXXXXXX` (8 uppercase hex characters, unique index, regenerated on collision) |
| Channels: text, voice, PDF, .eml | Text (required), screenshot (png/jpeg/webp ≤5 MB, magic bytes checked), voice (webm/ogg/mp3/m4a/wav ≤10 MB, transcribed with Groq Whisper), PDF (≤10 MB, `%PDF-` check, text via the existing pdf-parse path, no OCR). No .eml. |
| Keyword routing | The form opens with context (page, `?open=`, item id) and pre-selects the area. `other` is re-routed by server keyword rules (`config/earlyWarning.js AREA_KEYWORDS`), then by enrichment. |
| `TICKETS_PER_DEPARTMENT=2`, checked first → 429 | Setting `reports.maxOpenPerArea` (default 2). It is checked **in middleware before multer runs**, then once more after re-routing and before any model call. The 429 says "You already have 2 open reports about {area}. Please add to your existing report ({ref}) instead." |
| `enrich_one` (temperature 0, `max_attempts=2`, returns None on failure) | `reportEnrichment.enrichOne()` on FAST, JSON: `{area, urgency: low/medium/high, sentiment: −1..1, intent: bug/wrong_ai_answer/content_quality/feature_request/account/other, topic: 2-4 words, isRepeat}`. The report is saved **before** the call; a failure leaves `enrichment.status='pending'`. |
| Batch enrich (75 per call) | `npm run reports:enrich`: pending reports, 20 per call (keeps prompts under the 8k TPM limit), resumable. |
| My tickets + Updates | **My reports** page (`/reports`, `/reports/:ref`), plus a **bell** in `Navigationinner`. The bell polls `/api/notifications` every 60 s and on route change. |
| `resolve.py` (one notification per customer, only open/in-progress rows) | `reportService.resolveReports({refs \| area, note, status, actor})`. It updates `{status ∈ [open, in_progress]}` with a conditional `updateMany`, then re-reads the rows **this call actually changed** (by stamping `resolveBatchId`, which fixes EWDI's double-notify race). It groups them by student and sends exactly one `Notification` each. `POST /status` with `resolved` goes through this same function, closing EWDI's second resolve path that never notified. |
| Features: volume, authors, no-response, p50/p90 response, sentiment, negative share, urgency, repeat | Per area and day: `n_reports`, `n_reporters`, `pct_unresolved` (no admin response yet), `p50_first_response_h` and `p90_first_response_h` (log1p hours), `mean_sent`, `pct_negative`, `pct_urgent`, `repeat_rate`. **New telemetry features**: `ai_error_rate`, `ai_p95_latency` (log1p seconds), `ai_429_rate`, `gateway_failure_rate` (YouTube/PDF), `ai_report_rate` (reports pointing at an AI message ÷ AI calls, per 1k). |
| Slopes: volume, sentiment, no-response | Same three, plus `ai_error_slope` |
| Peers lane (system-wide if `elevated ≥ max(2, others//3)`) | Same rule, plus a gateway check: "if every AI area's `ai_error_rate` is up, blame the AI gateway, not one feature". |
| Embeddings (768-d, pgvector), FTS fallback | Gemini `gemini-embedding-001` with `outputDimensionality: 768` through the existing `@google/generative-ai`, stored in `ReportEmbedding`, searched with Atlas `$vectorSearch` (filter on area and time). Fallback is a `$text` index on `Report`. |
| Greedy cosine clustering τ 0.75 | Same algorithm, **per area**. `min_cluster` goes from 15 to 3 (Novard volumes). Topics are kept stable across re-clusters by matching centroids (cos ≥ 0.9 keeps the old id and label). Without embeddings, topic = the enrichment's `intent`. |
| Copilot | **Admin assistant**: same LangChain tool-calling loop, SSE events and card lifecycle as the Novard Agent, with its own tool registry (§8). |

---

## 3. Algorithms (pure module: `server/services/earlyWarning/scoring.js`)

This module is dependency-free JS. Every constant is a parameter whose default comes from `config/earlyWarning.js`.

- **`buildFeatures(daysByDate, windowEnd, cfg)`**: port of `build_features`.
  - `mean(window)`, baseline `median` and `MAD` (MAD only when there are ≥3 baseline values).
  - OLS `slope` over the window (same formula as `np.polyfit(x, y, 1)[0]`, 0 when fewer than 3 points).
  - Count metrics treat missing days as 0. Rate metrics skip days below the minimum.
  - **Tuned minimums**: EWDI uses `MIN_DAILY_RECORDS=15`. Novard uses `minDailyReports=3` for report rate metrics and `minDailyCalls=20` for AI/gateway rate metrics. At Novard's volume (single-digit reports per area per day), 15 would switch off every rate feature; 3 is the smallest count where a share is more than a coin flip.
- **`robustZ(v, med, mad, {relFloor=0.25, absFloor=1e-3, clip=6})`**: port.
  - Novard overrides `absFloor` **per feature** in config: counts 1.0, shares 0.05, log-latencies 0.1.
  - Without this, a quiet area with a baseline median of 0 turns one report into +6σ. Golden tests use the EWDI defaults, which proves the port is faithful; production uses the Novard floors.
- **`scoreWindow(f, directions, slopes)`**:
  - `anomalyZ` = mean of the top 3 positive contributions.
  - `score = 1/(1+e^−(z−2))`.
  - Attribution is `{feature, z (3 dp), share (4 dp)}`, sorted by |z|.
  - Every feature has an explicit `+1`/`−1` direction in config (`mean_sent` −1, everything else +1).
- **`percentile(arr, p)`**: numpy linear interpolation. `levelsFromPercentiles` uses P85/P95/P99, and `classify` is a port.
- **Levels policy**:
  - Percentile levels only when there are at least `minScoredWindows` (default 120, about 13 areas × 9 days) and the area's `status==='scored'`.
  - Otherwise, fixed thresholds: MEDIUM ≥ 0.50 (z ≥ 2), HIGH ≥ 0.82 (z ≈ 3.5), CRITICAL ≥ 0.95 (z ≈ 5).
  - Both sets are editable in the console (`risk.thresholds`).
- **Cold start**: an area whose baseline has fewer than `minBaselineActiveDays` (default 7) days with any activity gets `status: 'insufficient_baseline'` and is classified **only** with fixed thresholds.
- **`detectEscalations(rowsByArea)`**: pure port of `detect()`. It returns the marks; the service upserts `RiskAlert` with a unique index on `(area, windowEnd, level)`.
- **`nextLifecycle(existing, {score, isAlert})`**: pure port of `resolve_risk_object`'s state machine. It returns `{state, lowStreak, riseStreak, writePrecedent}`.
- **`greedyCluster(vectors, {tau: 0.75, minCluster, maxCentroids})`**: port of `cluster()`:
  1. L2-normalise.
  2. Seed greedily.
  3. Assign by argmax.
  4. Refine once, renormalise, reassign.
  5. Drop small clusters (keep the largest if none survive).

**Golden tests** (`server/tests/unit/earlyWarningGolden.test.js`):
- During Phase 4 I run EWDI's own functions from its `.venv` in the scratchpad (never in this repo): `robust_z`, `score_window`, `levels_from_percentiles`, `classify`, `slope`, `build_features` on fixed series, and the numpy core of `cluster()` on fixed vectors. `detect` and the lifecycle are DB-bound, so they get hand-built cases that mirror the Python branches.
- Only the output JSON is committed, as `server/tests/fixtures/ewdi-golden.json`. `ARCHITECTURE.md` explains in prose how it was generated. No Python enters the repo.

---

## 4. MongoDB data model

All models are Mongoose 8. `userId` and `adminId` are emails. Every list filter or sort field is indexed.

- **User** (extended): `role` (`student`\|`admin`\|`superadmin`, default `student`, indexed), `status` (`active`\|`suspended`, indexed), `suspendedAt`, `suspendedReason`, `aiQuotaResetAt`, and `timestamps` (not present today; I add it).
- **Report**:
  - Identity: `ref` (unique), `userId`, `userName`, `area`, `routedBy` (`context`\|`rules`\|`model`\|`student`).
  - Source: `source {page, tool, itemType, itemId, messageIndex, messageId, excerpt ≤4000, excerptVerified}`.
  - Content: `text` (10–4000 chars), `transcript`, `pdfText` (≤20k), `attachments [{kind: screenshot/voice/pdf, path, mime, size, originalName}]`, `channel`.
  - `enrichment {status: pending/done/failed, intent, urgency, sentiment, topic, isRepeat, model, promptVersion, at}`.
  - Workflow: `status` (open/in_progress/resolved/closed), `open` (bool), `quotaSlot`, `assignedTo`, `firstResponseAt`, `resolvedAt`, `resolveBatchId`, `notes [{author, authorRole, body, internal, at}]`.
  - `topicId`, `demo` (seed tag), `timestamps`.
  - **Indexes**:
    - unique partial `{userId, area, quotaSlot}` where `open: true`: the atomic quota;
    - `{area, createdAt}`, `{status, createdAt}`, `{userId, createdAt}`, `{'enrichment.status'}`;
    - `$text` on `text`, `transcript` and `source.excerpt`.
- **ReportEmbedding**: `{reportId (unique), area, createdAt (report time), vec [768], model, topicId}`, plus an Atlas vector index `report_vec` on `vec` with filters on `area` and `createdAt`. It is a separate collection so report reads stay small.
- **ReportTopic**: `{area, label, centroid, recordCount, firstSeenAt, updatedAt}`, indexed on `{area}`.
- **Notification**: `{userId, kind: report_resolved/report_reply/announcement, title, body, reportRefs[], link, readAt, createdAt}`, indexed on `{userId, createdAt:-1}` and `{userId, readAt}`.
- **AreaFeature**: `{area, windowEnd (Date, UTC midnight), windowDays, daily (that day's raw metrics), f (metrics, `__base_median`, `__base_mad`, slopes), hasEnrichment}`, unique on `(area, windowEnd)`. Storing each day's raw metrics also keeps history after `ModelCall` rows expire.
- **RiskScore**: `{area, windowEnd, anomalyZ, score, level, attribution, status: scored/insufficient_baseline, levelsFrom: percentile/fixed, modelVersion: 'anomaly-v1'}`, unique on `(area, windowEnd)`.
- **RiskObject**: `{area, topic, topicId, dedupeKey (unique), state, peakScore, currentScore, lowStreak, riseStreak, lastWindowEnd, firstDetectedAt, lastSeenAt, flagged}`, indexed on `{state, lastSeenAt}`.
- **RiskAssessment** (one per run):
  - `runId` (unique), `area`, `windowEnd`, `riskObjectId`, `trigger` (schedule/admin/assistant), `status` (running/done/error/interrupted), `outcome` (investigated/no_investigation_needed/investigation_incomplete).
  - `risk`, `budget {usdMax, usdUsed, tokensMax, tokensUsed}`.
  - `evidence [{id, lane, kind, summary, citeIds[], data}]`, `hypotheses [{cause, confidence, evidenceIds, contradictingIds, degraded, uncited}]`, `verification {verdict, unsupported, ignoredContradictions, overconfident, note, model}`, `revisionCount`, `predictions`.
  - `recommendations [{id, action, actionType, params, kind, priority, rationale, evidenceIds, execution, expectedEffect, status, approvedBy, decidedAt, result, error}]`.
  - `degraded`, `errors[]`, `startedAt`, `endedAt`. Indexed on `{area, startedAt:-1}`, `{status}`.
- **RiskStep**: `{runId, seq, node, lane, inputSummary, outputSummary ≤800, latencyMs, error, usd, tokens, createdAt}`, indexed on `{runId, seq}`.
- **ModelCall**:
  - `{feature, area, task, provider, model, tokensIn, tokensOut, usd, latencyMs, attempt, outcome (ok/429/429_daily/5xx/invalid_json/error/blocked), routedBy, runId, stepSeq, conversationId, userId, createdAt}`.
  - **Retention**: TTL of 45 days (`MODEL_CALL_RETENTION_DAYS`). Features need 28 days and the gateway pages show at most 30; after that, history lives in `AreaFeature.daily`.
  - Indexes: `{createdAt}` (TTL), `{feature, createdAt}`, `{model, createdAt}`, `{runId}`, `{userId, createdAt}`, `{conversationId}`.
- **GatewayEvent**: `{gateway: youtube/oauth/pdf, operation (search, captions, metadata, tokeninfo, extract, ocr), outcome: ok/fail/disabled, latencyMs, area, error ≤200, createdAt}`. TTL 45 days, indexed on `{gateway, createdAt}`.
- **RiskAlert**: `{area, windowEnd, level, prevLevel, score, prevScore, drivers, message, acknowledgedBy, acknowledgedAt, createdAt}`. Unique on `(area, windowEnd, level)`, indexed on `{acknowledgedAt, createdAt}`.
- **RiskPrecedent**: `{riskObjectId, area, cause, resolution, effective, closedAt}`, indexed on `{area, closedAt:-1}`.
- **RiskFeedback**: `{assessmentId, adminId, label: accurate/not_accurate, note}`, unique on `(assessmentId, adminId)`.
- **Setting**: `{key (unique), value (Mixed), updatedBy, updatedAt}`. The reserved key `__version` holds a counter, `$inc`'d on every write.
- **UsageCounter**: `{key (unique), value, expiresAt (TTL)}`. It holds the day's AI spend (`spend:2026-09-30`) and per-student daily AI requests (`ai:<email>:<day>`). Cheap `$inc`, no aggregation on the hot path.
- **AdminAuditLog**: `{adminId, adminRole, action, target {type, id}, before, after, ip, createdAt}`, append-only, indexed on `{createdAt:-1}`, `{adminId, createdAt}`, `{action, createdAt}`.
- **AdminConversation**: a separate collection built from the **same sub-schemas** as `ChatbotConversation`. I export `messageSchema`/`actionSchema` from `models/chatbotConversation.js` (no behaviour change) and add `adminId`.
  - **Why not a `scope` field?** Every student query (`find({userId})` in `agent/conversations.js`, `analyticsService.loadActivity`) would need a new filter. One missed filter would leak admin chats (full of other students' data) into a student's agent history, or count them as study activity. A separate collection makes that impossible by construction.

Announcements are fanned out to `Notification`: the "all students" audience uses `insertMany` in batches of 1,000; the "area reporters" audience is small. The dashboard banner is the `banners.dashboard` setting. Fan-out cost at large scale is listed under known gaps.

---

## 5. Admin authentication and permissions

- **Sign-in**: `/admin/login` is a page styled like `Landing`. It uses the same `useGoogleLogin` client and calls `POST /api/admin/auth/google {accessToken}`, which:
  1. reuses `authService.verifyGoogleAccessToken` and `upsertUser`;
  2. applies `SUPERADMIN_EMAILS` promotion (student sign-in applies it too);
  3. requires `role ∈ {admin, superadmin}` and `status==='active'`, otherwise 403 `NOT_ADMIN`: "This Google account is not a Novard-AI admin." No token is issued.
- **Rate limit**: `adminAuthLimiter` allows 10 per 15 min per IP (env `RATE_LIMIT_ADMIN_AUTH_PER_15_MIN`).
- **Admin JWT**: `audience: 'novard-ai-admin'`, `role` claim, `expiresIn: ADMIN_JWT_EXPIRES_IN` (12h). Audiences are separate, so student tokens never pass admin checks and admin tokens never pass `requireAuth`. The client keeps the admin token under `admin_token`, separate from `auth_token`, so the student session is untouched.
- **`requireAdmin()`** (`middleware/adminAuth.js`): verifies the token, then does **one indexed DB read of role and status on every admin request** (not just "sensitive" ones: it costs about 1 ms and removes a class of bugs). A demoted or suspended admin gets 401 `ADMIN_REVOKED` immediately. **`requireSuperadmin()`** also requires `role==='superadmin'`.
- **Suspended students**: `requireAuth` does one indexed read. If a user doc exists and `status==='suspended'`, it returns 403 `ACCOUNT_SUSPENDED` with a friendly message. The client interceptor signs out and the landing page shows the message. A missing user doc is allowed, so existing test tokens keep working.
- **`/api/auth/me`** adds `role`. The user popup shows an "Admin console" link for admins.
- **Bootstrap**:
  - `SUPERADMIN_EMAILS=a@x.com,b@y.com`;
  - or `npm run admin:grant --prefix server -- --email x --role superadmin|admin|student`, which uses `MONGO_URI` and writes an audit entry with `adminId: 'cli'`.

**Permission matrix**

| Capability | admin | superadmin |
|---|---|---|
| All console reads, assistant, investigations, approvals, reports inbox, moderation, announcements | ✓ | ✓ |
| Feature flags, per-tool maintenance, model routes, provider/feature switches, per-student quota | ✓ | ✓ |
| Suspend or reactivate **students**, reset quota, reveal a student's email (audited) | ✓ | ✓ |
| Grant or revoke admin; suspend or reactivate admins | ✗ | ✓ |
| Settings marked critical: global USD cap, rate limits, whole-app maintenance, investigation budgets | ✗ | ✓ |

- Nobody can change their own role or suspend themselves.
- **The last active superadmin** can't be demoted or suspended (409).
- **Audit**: `auditService.record()` is called inside each mutating service function, so the console, the assistant and approvals all audit identically. The UI is read-only.

---

## 6. Model layer, settings, enforcement

### 6.1 Runtime settings (`services/settingsService.js`, registry in `config/admin.js`)

- The registry lists each key with a default (env, then code), a validator, a group, a `critical` flag and a description.
- `get(key)` resolves **DB > env > default**, cached for 30 s. When the TTL expires it reads only `__version`, and reloads everything if the version changed. `set()` validates, writes, `$inc`s `__version`, clears the local cache and audits.
- Keys:
  - `features.<tool>` `{enabled, message}` for: notes, videoSummarizer, videoLibrary, doubts, quizzes, skillUnlocker, roadmap, skillGap, forumAi, agent, reports, voiceReports.
  - `maintenance` `{global:{enabled, message}, tools:{...}}`.
  - `rateLimits` `{apiPerMinute, aiPerMinute, authPer15Minutes}`.
  - `ai.providers` `{groq, gemini}`.
  - `ai.routes` (task → model).
  - `ai.failover` `{REASONING:[], FAST:[]}`.
  - `ai.params` `{reasoningEffort, maxTokensScale}`.
  - `ai.limits` `{perStudentDaily: 0 (off), globalDailyUsdCap: 0 (off), nonEssential:[...]}`.
  - `gateways.youtube.enabled`.
  - `reports` `{maxOpenPerArea, areas}`.
  - `risk.thresholds`, `risk.coldStart`, `risk.budget` `{usdMax, tokensMax, laneConcurrency}`, `risk.autoInvestigate`.
  - `assistant` `{turnUsdMax, maxSteps}`.
  - `banners.dashboard`.
- `config/ai.js` stays the single source of defaults and reads overrides through `settingsService`.
- **Rate limits pick up changes live**: `express-rate-limit` v8 accepts `limit: (req) => …` (verified in `node_modules`), so the limiters call `settings.get('rateLimits')`.

### 6.2 `config/ai.js` additions

- `TASKS` maps each task to a tier: `report_enrich` FAST, `report_transcribe` WHISPER, `report_embed` EMBED, `risk_supervisor` FAST, `risk_lane` FAST, `risk_root_cause` REASONING, `risk_verifier` GEMINI (falls back to FAST without a key), `admin_assistant` REASONING.
- `route(task, attempt, confidence)`:
  - Escalates on retry or low confidence: lane/supervisor move from FAST to REASONING; root_cause moves to REASONING with `reasoningEffort: 'medium'`.
  - Admin overrides from `ai.routes` win.
  - Enforces verifier ≠ root_cause's actual model.
- `FAILOVER`: REASONING `[gpt-oss-120b → gpt-oss-20b]`, FAST `[gpt-oss-20b → gpt-oss-120b]`, env-overridable.
- `PRICING` (USD per 1M tokens, approximate, editable).
- `MODELS.WHISPER` (`GROQ_TRANSCRIBE_MODEL`, default `whisper-large-v3-turbo`), `MODELS.EMBED` (`GEMINI_EMBED_MODEL`, default `gemini-embedding-001`), `EMBED_DIM=768`.

### 6.3 Call path (`ai/modelGateway.js`, `ai/aiContext.js`, `ai/modelCallLog.js`, `ai/usageGuard.js`)

- **`aiContext`**: AsyncLocalStorage holding `{feature, area, userId, runId, stepSeq, conversationId}`, set by the `aiFeature('notes.chat')` middleware added to each existing AI route in `routes/*.js`, and by the graph and assistant.
- **Logging**:
  - `complete()` and `geminiGenerate()` wrap their SDK calls with timing and a `recordModelCall`.
  - `chatModel()` attaches a LangChain `BaseCallbackHandler` (`handleLLMEnd`/`handleLLMError`, reading `usage_metadata`/`tokenUsage`). This covers `converse`, the memory summary, the agent (with `streamUsage`), forum AI and `doubtTitle`.
  - Each record also `$inc`s today's spend counter.
  - Failures to log are swallowed and never break a student call.
- **Fail-over and retry, per error type**:
  - A **per-minute 429** keeps today's `withRateLimitRetry` ("try again in N s").
  - A **daily-quota 429** (message mentions requests/tokens per day, or the wait is over 30 s) fails over to the next model in the tier's `FAILOVER` chain.
  - **5xx** gets exponential backoff (1 s, 2 s, 4 s plus jitter, at most 3 tries).
  - **Invalid JSON** (new JSON tasks only) runs `parseModelJson` first. If that fails, the call repeats once with "Your previous output was not valid JSON…".
  - When everything is exhausted, the call throws `AIUnavailableError` so callers degrade deterministically.
- **New JSON tasks** use `response_format: {type: 'json_object'}` plus loose coercion. Following your memory note on Groq strict validation: no enums in schemas, nullable types, allowed values stated in the prompt.
- **Enforcement** (`usageGuard`, checked before each call and in `requireFeature`/`aiQuota` middleware):
  - A disabled provider or feature returns 503 `FEATURE_UNAVAILABLE` with the admin's message, or "This tool is temporarily unavailable. Please try again later." The client shows it through the existing `errorMessage`.
  - The per-student daily quota returns 429 `AI_QUOTA_REACHED` with a friendly message.
  - When the global USD cap is reached, **non-essential** features are blocked with a friendly message: forum auto-replies, doubt and library video keywords, course discovery, embeddings, scheduled investigations, report enrichment (which falls back to the batch). Chats, quizzes and summaries keep working. Admin-triggered actions are exempt.
- **At defaults** (quota 0, cap 0, everything enabled), behaviour is unchanged and every existing test must stay green.

### 6.4 Investigation budget (the TPM problem)

Your memory note says Groq allows about 8k tokens per minute **per model**. EWDI's $0.25/60k was sized for Gemini lite. The binding constraint here is TPM, not USD.

- **Per-call caps**:
  - Lane: prompt at most ~1.2k tokens (tool text trimmed to 1,500 chars), `maxTokens` 300.
  - Supervisor: ~1.2k in, 200 out.
  - Root cause: ~3k in, 900 out.
  - Verifier: ~2.5k in, 400 out.
- **Typical run**: 2 supervisor calls + 5 lanes + root cause + verifier ≈ **14–18k tokens**. Worst case with 3 loops and 1 revision ≈ 30k.
- **Spread across models**: supervisor and lanes on gpt-oss-20b (≈ 9k), root cause on 120b (≈ 4–8k), verifier on Gemini (or 20b). With `laneConcurrency: 2` (a per-run semaphore around the `Send` lanes), 20b sees at most about 2.5k tokens in flight. That means at most one "try again in N s" wait, and a run finishes in about 1–2 minutes.
- **Defaults**: `tokensMax 40_000`, `usdMax $0.03` (40k × ≤$0.75/M ≈ $0.03). Both are editable (superadmin).
- **Enforcement**: usage is accumulated through a reducer (`usage`, like EWDI's `merge_usage`). **Before every model node** the graph compares used vs max. If exhausted, that node takes its degrade path (supervisor → analyze, lane → raw evidence, root_cause → statistical, verifier → "unaudited"), and the run finishes with `degraded:true` and `errors:['budget exhausted']`.

---

## 7. LangGraph.js investigation (`server/services/earlyWarning/graph/`)

New dependency: `@langchain/langgraph@^1.4` (plain JS; peer `@langchain/core ^1.1.48` is already satisfied by 1.2.12; peer `zod` is already present at 4.6.5).
- **Why**: the brief asks for EWDI's `Send` fan-out and reducers, and LangGraph.js has the same API as the Python original.
- **Rejected**: a hand-rolled state machine. It would drift from EWDI and lose the `Send`/reducer semantics.

- **State** (`Annotation.Root`): `runId, area, windowEnd, features, risk, riskObjectId, riskState, chosenLanes, supervisorReason, hypotheses, recommendations, verification, revisionCount, prediction, loopCount, budget, next`. Append reducers on `evidence`, `lanesDone` and `errors`; a summing reducer on `usage`.
- **Spine (zero tokens)**: `buildFeatures → scoreRisk → resolveRiskObject → routeByLevel`. It reads `AreaFeature`/`RiskScore` (computing them if missing) and calls the same lifecycle function as the rescan (idempotent per `windowEnd`). LOW/MEDIUM → `updateMonitor` → END.
- **Supervisor**: EWDI's prompt, adapted to Novard. Lanes: temporal, peers, history, semantic, **telemetry**. Output `{action, lanes, reason}`. Cap of 3 loops or budget, then analyze. If the model fails: loop 0 opens all lanes, later loops analyze.
- **Lanes** (`laneTools.js`, whitelisted, parameterised Mongo aggregations only; a model never writes a query):
  - `temporal`: 28 days of `AreaFeature.daily` plus the rising/flat/falling rule (1.15×/0.85×).
  - `peers`: all areas' `RiskScore` at `windowEnd`, the system-wide rule, and an "AI areas all elevated → gateway" check.
  - `history`: the latest 5 `RiskPrecedent` plus resolved assessments.
  - `semantic`:
    1. `topTopics` (reports by topic over 7 days, with the 5 most negative refs each).
    2. Vector search: `$vectorSearch` with query vector = the dominant topic's **centroid**, so no embedding call is needed, falling back to embedding a driver-based query. It runs only when `vectorSearch` is enabled and the area has ≥ `semanticMinVectors` (default **30**; EWDI used 50, which Novard areas may never reach). Otherwise `$text` with OR'd terms.
    3. Evidence cites report refs.
  - `telemetry`: `ModelCall` errors/429s/p95 for the area's features over 7 days vs baseline, plus `GatewayEvent` failure counts, **citing sample failing ModelCall ids** (`MC-…`).
  - Each lane makes one interpretation call; if it fails, the raw evidence is kept (EWDI's no-duplicate rule applies).
- **Citable ids**: report refs, `MC-…` model calls, `GW-…` gateway events, and **evidence ids `E1…En`**. EWDI's lanes other than semantic couldn't be cited, which would have made "Groq outage" uncitable. The allowed-id list goes into the root_cause prompt, and unknown ids are removed.
- **root_cause**: EWDI's prompt and rules. 1–3 hypotheses, 2–4 recommendations.
  - Each recommendation also carries `actionType` from a **catalog**:
    - `flag_area` (the only `auto` type);
    - `set_feature_flag {feature, enabled, message}`;
    - `known_issue_banner {tool, message}` (per-tool maintenance message with the tool still enabled);
    - `set_model_route {task, model}`;
    - `bulk_resolve {area, note}`;
    - `broadcast {audience, title, body}`;
    - `advice` (text only, nothing to execute).
  - **The server forces `execution`**: `auto` only for `flag_area`, everything else `manual`, whatever the model said. It validates params against the same validators the console uses.
  - If the model is down: the statistical explanation from attribution, confidence 0.3, `degraded:true`.
- **Verifier**: EWDI's prompt, on a different model. `accept | revise | need_more_evidence`. `routeAfterVerify` is ported exactly: revise at most once; need_more_evidence goes to the supervisor if `loop < 3`. If the verifier is down, it accepts as "unaudited".
- **Predictor** (no model):
  - What-ifs: "resolve the open backlog" (`pct_unresolved` → 0, response latency → baseline median), "AI error rate back to baseline", "report volume +30%".
  - `p_incident = base ± 0.05` (EWDI's formula). `POST …/whatif` takes allow-listed `{feature: multiplier 0–5}`.
- **Action**: writes hypotheses and recommendations. `auto` ones execute immediately (`flag_area` sets `RiskObject.flagged`, audited as `system`). `manual` ones get `awaiting_approval`.
  - **Approve** → `recommendationService.execute(rec)` calls exactly the service the console control uses: `settingsService.set`, `reportService.resolveReports`, `announcementService.broadcast`, audited as the approving admin.
  - Approval claims the recommendation atomically (`status: awaiting_approval → approved`, conditional update, same pattern as `conversations.js` `setAction`), so it can't run twice.
- **Runner**:
  - `runAssessment({area, trigger, actor})` creates the `RiskAssessment` and runs `graph.invoke(init, {recursionLimit: 40})` inside an `aiContext` with `runId`.
  - A `timed()` wrapper writes a `RiskStep` per node (seq, latency, summaries, error); model calls carry `runId` and `stepSeq`.
  - `POST /assess` returns 202 `{runId}` and runs in the background.
  - A run left `running` for over 15 min is shown as `interrupted`.
- **Live view**: `GET /api/admin/risk/runs/:id/stream` (SSE, same framing as `/api/agent/chat`) polls `RiskStep` and `ModelCall` every 500 ms (works across Cloud Run instances). Events: `step {…}`, `call {…}`, `done {status, outcome, cost}`. Max 10 min. The client reads it with the fetch-reader pattern from `agentStream.js`, because `EventSource` can't send the bearer token.
- **Degradation test**: with every Groq/Gemini call throwing, the graph still ends `done`, `degraded:true`, with cited evidence from the tool lanes (report refs, `MC-…` ids) and the statistical hypothesis.

---

## 8. Admin assistant (`server/services/adminAssistant/`)

- **Engine**: the same building blocks as the Novard Agent: `chatModel().bindTools`, `withRateLimitRetry` streaming, `MongoChatHistory` summary-buffer memory (over `AdminConversation`), the same SSE events (`meta/token/status/action/done/error`), and the same card lifecycle and atomic claiming as `agent/conversations.js`.
  - Its own loop file (about 250 lines). `novardAgent.runTurn` is student-specific (learner profile, drafts, suggestions), and bending it would risk the student agent.
- **Read tools**: `risk_board`, `area_detail(area)`, `list_reports(area?, status?, urgency?, limit?)`, `search_reports(query)`, `gateway_status(gateway?)`, `cost_report(scope?)`, `recent_runs(limit?)`, `run_findings(runId)`, `platform_stats()`, `user_lookup(query)`. `user_lookup` returns names and masked emails.
- **Mutating tools** (each creates a **confirmation card**; nothing runs until the admin presses Confirm; each executes via the console's service; each is audited):
  - `start_investigation(area)`: the card's result is filled when the run ends: outcome plus exact cost summed from `ModelCall` by `runId`, with a link to the live view.
  - `resolve_reports(area?|refs, note)`
  - `set_feature_flag(feature, enabled, message?)`
  - `set_model_route(task, model)`
- **Refusals**: API keys, admin grants, suspensions and critical settings are refused with a pointer to the console page. This is enforced in code (a `FORBIDDEN_INTENTS` check on the tool name and args, plus the system prompt).
- **Guards**:
  - At most one card per mutating tool per turn, and at most 2 cards.
  - Args filtered to a per-tool allow-list.
  - Tool results trimmed to 3,500 chars for the model and 2,000 in the log.
  - `maxSteps 5`; per-turn USD cap `assistant.turnUsdMax` (default $0.01), checked before each step.
- **Evidence guard** (port of EWDI's regexes, with Novard vocabulary: report/area/risk/alert/cost/spend/token/users/gateway/quota…):
  - A live-data question answered with no tool call is forced to call one, once.
  - **New (EWDI doesn't do this)**: every number in the reply (at least 2 digits, a decimal or a percentage) must appear in the tool results, after normalising commas and % vs fractions. If not, the model gets one repair turn. After that, the reply carries a visible "Some figures could not be verified against live data" note, and the turn is logged `unverifiedNumbers: true`.
- **Logging**: every turn goes to `AdminConversation` plus `ModelCall` with the `conversationId`.

---

## 9. Scheduling and scripts (Cloud Run scales to zero)

- `services/earlyWarning/rescan.js` → `rescanAll({now})`:
  1. features for every area and missing day;
  2. scores and levels;
  3. escalations;
  4. lifecycle.

  It is idempotent (upserts on unique keys). Used by:
  - `npm run risk:score`
  - `POST /api/internal/risk/rescan` (header `X-Risk-Cron-Secret` must equal `RISK_CRON_SECRET`, compared in constant time; 404 when the secret isn't set)
  - the console's "Rescan now"
  - the **lazy rescan** when the board is opened and the latest `windowEnd` is older than yesterday
- If `risk.autoInvestigate` is on (default **off**, free-tier cost), the scheduled rescan investigates newly raised alerts only, capped at 2 per rescan.
- `npm run reports:enrich`: pending/failed enrichment, batches of 20, resumable.
- `npm run reports:embed`: reports without embeddings, 50 per batch, then re-clusters topics. New reports are also embedded fire-and-forget after submission; a failure never blocks the report.
- `npm run db:vector-index`: `collection.createSearchIndex({type: 'vectorSearch', …})`, idempotent (it updates a definition that differs). On a cluster without search it prints "This MongoDB does not support Atlas Vector Search; the app will use the $text fallback."
- `npm run admin:grant`.
- `npm run risk:seed-demo -- --area video-summarizer [--student you@gmail.com] | --clear`:
  - 28 quiet days in **every** area (so peers and baselines exist);
  - a 6-day ramp in the target area: reports ×(0.45 + 0.55·ramp), 60–90% urgent, sentiment −0.95…−0.55, rising caption failures (`GatewayEvent`) and AI errors (`ModelCall`), with realistic Novard complaint text;
  - deterministic enrichment and embeddings skipped (so `$text` works everywhere);
  - clears that area's alerts, then runs `rescanAll`, so a real HIGH/CRITICAL alert fires.
  - `--student` makes some spike reports belong to your account, so you see the notification.
  - Everything carries `demo: true`, and `--clear` removes exactly that.
- **Docker**: the `mongo` service moves to `mongodb/mongodb-atlas-local` (same port 27018 and volume). `MONGO_URI` gains `?directConnection=true`. `DOCKER_SETUP.md` documents this, including the 7.0 → 8.x data-files note (§13 Q3). `docker-compose.prod.yml` stays on Atlas.
- **Deploy**: optional Cloud Scheduler setup (`RISK_CRON_SECRET`, `gcloud scheduler jobs create http … --schedule "15 * * * *"`) in `deploy.sh` and `CLOUD_RUN_SETUP.md`.

---

## 10. API

Every route below follows routes → controllers → services, uses `validate.js`, and returns `HttpError` JSON. **AI** marks routes behind `aiLimiter` plus the feature and quota guard.

**Student** (`requireAuth`, always scoped to the session user):

| Method | Path | Notes |
|---|---|---|
| POST | `/api/reports?area=` | **AI**. Quota check, then multer (`screenshot`, `voice`, `pdf`), then save, then transcribe, enrich and embed (best-effort). Returns 201 `{ref, status, area, …}` |
| GET | `/api/reports/mine` | |
| GET | `/api/reports/:ref` | Own reports only; public notes only |
| POST | `/api/reports/:ref/notes` | Student reply; re-opens a `resolved` report as `open` |
| GET | `/api/reports/:ref/attachments/:n` | Own report's files |
| GET | `/api/notifications` | |
| POST | `/api/notifications/read` | `{ids?}` |
| GET | `/api/app-status` | Flags, maintenance, banner, `reports {areas, maxOpenPerArea, voiceEnabled}` |

**Admin** (`requireAdmin`; ★ = `requireSuperadmin`):
- Auth and overview: `POST /api/admin/auth/google` (adminAuthLimiter, no auth), `GET /api/admin/auth/me`, `GET /api/admin/overview`.
- Risk:
  - `GET /api/admin/risk/board`
  - `GET /api/admin/risk/areas/:area`
  - `POST /api/admin/risk/areas/:area/assess` (**AI**)
  - `POST /api/admin/risk/rescan`
  - `GET /api/admin/risk/alerts`
  - `POST /api/admin/risk/alerts/:id/ack`
  - `GET /api/admin/risk/assessments/:id`
  - `POST …/recommendations/:recId/approve`
  - `POST …/recommendations/:recId/dismiss`
  - `POST …/feedback`
  - `POST …/whatif`
  - `GET /api/admin/risk/runs`
  - `GET /api/admin/risk/runs/:id`
  - `GET /api/admin/risk/runs/:id/stream`
- Reports:
  - `GET /api/admin/reports`
  - `GET /api/admin/reports/:ref`
  - `GET /api/admin/reports/:ref/attachments/:n`
  - `POST /api/admin/reports/:ref/reporter-email` (audited reveal)
  - `POST /api/admin/reports/:ref/status`
  - `POST /api/admin/reports/:ref/notes`
  - `POST /api/admin/reports/:ref/assign`
  - `POST /api/admin/reports/resolve`
  - `POST /api/admin/areas/:area/resolve`
- Gateways and costs: `GET /api/admin/gateways`, `GET /api/admin/gateways/:id`, `PUT /api/admin/gateways/:id/settings`, `POST /api/admin/gateways/:id/test` (**AI**), `GET /api/admin/costs`.
- Users:
  - `GET /api/admin/users`
  - `GET /api/admin/users/:id`
  - `POST /api/admin/users/:id/suspend`, `POST /api/admin/users/:id/reactivate` (★ when the target is an admin)
  - `POST /api/admin/users/:id/reset-quota`
  - `POST /api/admin/users/:id/reveal-email`
  - `POST /api/admin/users/:id/role` ★
- Forum moderation: `GET /api/admin/forum/issues`, `GET /api/admin/forum/issues/:issueId`, `PUT /api/admin/forum/issues/:issueId/status`, `DELETE /api/admin/forum/issues/:issueId`, `DELETE /api/admin/forum/comments/:commentId`, `PUT /api/admin/forum/comments/:commentId/hidden`.
- Settings and announcements: `GET /api/admin/settings`, `PUT /api/admin/settings/:key` (★ for critical keys), `GET /api/admin/announcements`, `POST /api/admin/announcements`.
- Assistant: `POST /api/admin/assistant/chat` (**AI**, SSE), `GET /api/admin/assistant/conversations`, `GET`/`PATCH`/`DELETE /api/admin/assistant/conversations/:id`, `POST /api/admin/assistant/conversations/:id/actions/:actionId`.
- `GET /api/admin/audit-log`.

**Internal**: `POST /api/internal/risk/rescan`.

This adds about 65 routes to today's 67. The final count goes into the README ("63" in two places is already stale).

No API key value is ever serialised. Gateways return `{configured, last4}` only. A test walks every admin endpoint's JSON and asserts no env key value appears in it.

---

## 11. Client

**Student**:
- **Report dialog**: `components/reports/ReportProblemDialog.jsx` is a modal using `Field`, `inputClass`, `btn` and `Toast` from `LearningUI`. It has an area select (pre-filled), text with a counter, a screenshot picker, a voice recorder (MediaRecorder; **hidden when `voiceEnabled` is false**) and a PDF picker. On 429 it shows the quota message with a link to the existing report.
- **Opening the dialog**: `ReportContext` provides `useReportProblem().open({area, source})`. `AppStatusContext` provides `/api/app-status` (polled every 60 s).
- **Entry points** (small "Report" icon buttons in the existing hover toolbars):
  - `ChatPanel` gets an optional `onReport(message, index)` prop, which covers Notes, Doubts and Video.
  - `SummaryView` gets an optional `onReport`.
  - `QuizRunner` gets a per-question "Report this question" link.
  - `AgentMessage` toolbar, next to `CopyButton`.
  - `SkillGapChat` `Bubble`.
  - `IssueDetail` AI comments.
  - `RoadmapView` header.
  - A "Report a problem" item in the `Sidebar` footer.
  - "My reports" and (for admins) "Admin console" in the `Navigationinner` user popup.
- **Bell**: `components/NotificationBell.jsx`, placed in `Navigationinner` just before the user pill. It shows an unread badge and a dropdown list styled like the popup, and marks items read.
- **Pages**: `pages/Reports.jsx` (My reports, list and detail with the status timeline and replies), using the same shell.
- **Unavailable features**: shown through the existing `errorMessage`/`Toast` path (the server sends the friendly text), plus a `FeatureNotice` banner at the top of an affected tool view, and a maintenance or dashboard banner on `HomePage`.
- **Agent**: a `report_problem` ACTION and a single prompt line. Per your memory note, I run a live scenario against Groq using in-memory Mongo after the change.

**Admin** (all under `client/src/pages/admin/` and `components/admin/`, JSX):
- **Session**: `AdminAuthContext.js` and `lib/adminApi.js` (an axios instance with the admin token; 401 goes to `/admin/login`).
- **Routing**: `App.js` gets `/admin/login` and `/admin/*` behind an `adminRoute` guard, like `protectedRoute`.
- **Layout**: `AdminLayout` = `Navigationinner` (title plus a "Back to Novard" link) + `Sidebar` extended with the optional props `items`, `footer`, `matchPrefix` and `drawer`. The student call sites pass none, so they are unchanged.
- **Shared components, extended rather than forked**:
  - `Profile.jsx`'s local `Card`, `Stat` and `SectionTitle` are extracted to `components/profile/blocks.jsx` and imported back into Profile (identical output).
  - `Badge` gains a `red` tone (status only).
  - A new `components/ui/DataTable.jsx` uses `TestPerformance`'s exact table classes, with horizontal scroll inside the card.
  - `charts.jsx` gains `Sparkline`, `ColumnChart` (vertical bars), and `LineChart` props `series` (multi-line) and `thresholds` (dashed level lines).
  - `TabBar`, `GeneratingState`, `EmptyState` and `MarkdownView` are reused as-is.
- **Console pages** (each matching §6 of the brief):
  - `Overview`, `RiskBoard`, `AreaDetail`, `AlertDetail` (assessment detail), `LiveRun`, `ReportsInbox`, `ReportDetail`, `Gateways`, `GatewayDetail`, `Users`, `UserDetail`, `Moderation`, `FeaturesLimits`, `Announcements`, `Assistant`, `AuditLog`.
  - The alert banner polls `/api/admin/risk/alerts` every 20 s (EWDI's interval) from `AdminLayout`.
- **Colours**: blue for actions and selection; green/amber/red only for level and status pills; grey everywhere else.

---

## 12. New and changed files

**Server, new**:
- Config: `config/earlyWarning.js`, `config/admin.js`.
- `ai/`: `aiContext.js`, `modelGateway.js`, `modelCallLog.js`, `usageGuard.js`, `embeddings.js`, `transcribe.js`.
- Middleware: `middleware/adminAuth.js`, `middleware/featureGate.js` (`aiFeature`, `requireFeature`, `aiQuota`).
- `models/`: `report`, `reportEmbedding`, `reportTopic`, `notification`, `areaFeature`, `riskScore`, `riskObject`, `riskAssessment`, `riskStep`, `modelCall`, `gatewayEvent`, `riskAlert`, `riskPrecedent`, `riskFeedback`, `setting`, `usageCounter`, `adminAuditLog`, `adminConversation`.
- `services/`: `settingsService`, `auditService`, `appStatusService`, `reportService`, `reportEnrichment`, `reportTopics`, `notificationService`, `announcementService`, `gatewayEvents`, `gatewayService`, `costService`, `adminUserService`, `adminAuthService`, `moderationService`, `recommendationService`.
- `services/earlyWarning/`: `scoring.js`, `features.js`, `scores.js`, `escalation.js`, `lifecycle.js`, `rescan.js`, `laneTools.js`, `semanticSearch.js`, `graph/{state,nodes,agents,build,runner}.js`.
- `services/adminAssistant/`: `assistant.js`, `tools.js`, `guard.js`, `conversations.js`.
- `routes/`: `reports.js`, `notifications.js`, `appStatus.js`, `internal.js`, `admin/index.js` plus one router per section.
- `controllers/`: `reportController`, `notificationController`, `appStatusController`, `internalController`, `admin/*Controller`.
- `scripts/`: `adminGrant.js`, `riskScore.js`, `reportsEnrich.js`, `reportsEmbed.js`, `vectorIndex.js`, `riskSeedDemo.js`.
- `tests/`: `api/*.test.js` and `unit/*.test.js` per §14, `fixtures/ewdi-golden.json`, helpers `bearerAdmin()` and `fakeGraphModels`.

**Server, changed** (small, additive):
- `app.js`
- `routes/index.js`, plus `aiFeature()` on each AI route in `routes/{notes,doubts,videos,forum,learning,agent}.js`
- `middleware/auth.js` (suspension check), `middleware/rateLimit.js` (dynamic limits)
- `services/authService.js` (role, `SUPERADMIN_EMAILS`, admin token), `controllers/authController.js` (`/me` role)
- `models/user.js`, `models/forumComment.js` (`hidden`), `models/chatbotConversation.js` (export sub-schemas)
- `services/forumService.js` (`asAdmin`, `deleteComment`, hidden filter)
- `ai/groqClient.js`, `ai/conversation.js`, `ai/gemini.js` (logging, guard, fail-over), `config/ai.js`, `config/env.js`
- `services/youtubeService.js`, `doubtService.js`, `videoRequestService.js`, `notesService.js`, `authService.js` (gateway events, YouTube switch)
- `agent/actions.js`, `agent/novardAgent.js` (`report_problem`)
- `package.json` (deps and scripts)

**Client, new**:
- `AdminAuthContext.js`, `lib/adminApi.js`, `lib/adminStream.js`, `lib/reports.js`
- `context/ReportContext.jsx`, `context/AppStatusContext.jsx`
- `components/reports/*`, `components/NotificationBell.jsx`, `components/FeatureNotice.jsx`, `components/ui/DataTable.jsx`, `components/profile/blocks.jsx`
- `components/admin/*`, `pages/Reports.jsx`, `pages/admin/*`
- Tests under `__tests__`

**Client, changed**:
- `App.js`, `lib/api.js` (the `ACCOUNT_SUSPENDED` event), `AuthContext.js` (role)
- `Sidebar.jsx`, `navigationinner.jsx`
- `learning/LearningUI.jsx` (`onReport` props, `Badge` red tone)
- `profile/charts.jsx`, `pages/Profile.jsx` (imports the extracted blocks)
- The report hooks in `NotesInlineView`, `DoubtClearanceInlineView`, `VideoSummarizerInlineView`, `agent/AgentMessage.jsx`, `skillgap/SkillGapChat.jsx`, `IssueDetail.jsx`, `roadmap/RoadmapView.jsx`, `pages/HomePage.jsx` (banner)

**Infra and docs**:
- `docker-compose.yml`, `docker-compose.prod.yml` (new env vars), `deploy.sh`, `cloudbuild.yaml`
- `server/.env.example`, `README.md`, `DOCKER_SETUP.md`, `CLOUD_RUN_SETUP.md`
- `docs/early-warning/PLAN.md` and `ARCHITECTURE.md`

**New dependencies**:

| Package | Why | Rejected alternative |
|---|---|---|
| `@langchain/langgraph` ^1.4 | EWDI's graph: `Send` fan-out, reducers, `recursionLimit` | Hand-rolled state machine: drifts from EWDI and re-implements parallel fan-in |
| (explicit) `zod` ^4 | LangGraph peer, already installed transitively | – |

- Groq Whisper uses the existing `groq-sdk` (`audio.transcriptions` exists in 0.8.0).
- Embeddings use the existing `@google/generative-ai` (`embedContent`/`batchEmbedContents`).
- Vector search runs **inside MongoDB Atlas** (no new service); locally, the `mongodb-atlas-local` image.
- No client dependencies are added: charts are hand-written SVG, and voice uses the browser `MediaRecorder`.

**New env vars**:
- `SUPERADMIN_EMAILS`, `ADMIN_JWT_EXPIRES_IN` (12h), `RISK_CRON_SECRET`
- `RATE_LIMIT_ADMIN_AUTH_PER_15_MIN` (10)
- `GROQ_TRANSCRIBE_MODEL`, `GEMINI_EMBED_MODEL`, `EMBED_DIM` (768)
- `VECTOR_SEARCH` (`auto`\|`on`\|`off`; default `auto` tries `$vectorSearch` and falls back on error)
- `GROQ_FAILOVER_REASONING`, `GROQ_FAILOVER_FAST`
- `MODEL_CALL_RETENTION_DAYS` (45)

Each is optional; when missing, that capability is off or falls back.

---

## 13. Phases

Each phase ends with `npm test` and `npm run lint` green (server and client) and one commit on `feature/early-warning`.

1. **Roles and admin foundation**: `User` role/status, admin sign-in plus JWT, `requireAdmin`/`requireSuperadmin`, suspension check, `SUPERADMIN_EMAILS`, `admin:grant`, `AdminAuditLog` plus `auditService`, `Setting` plus `settingsService` (registry, layering, validation, version cache), dynamic rate limits, `/api/app-status`, `/me` role. No student-visible change.
2. **Model layer and enforcement**: `aiContext` plus `aiFeature` tags on every AI route, `ModelCall` logging at the three choke points (including LangChain streaming), `GatewayEvent` instrumentation, `route()`/`FAILOVER`/`PRICING`, daily-429 fail-over, 5xx backoff, JSON repair, `usageGuard` (switches, quota, USD cap), friendly 503/429.
3. **Reports and notifications**: models, atomic quota, upload plus signature checks, Whisper, enrichment (immediate plus batch), `resolveReports`, notifications, embeddings plus `$text`, vector index script, topics clustering. Then the student UI: dialog, entry points, bell, My reports, the agent's `report_problem` (plus a live Groq scenario), `FeatureNotice`/banners.
4. **Scoring**: pure `scoring.js` plus golden fixture, features/scores/levels/cold start, escalation, lifecycle, `rescan`, `risk:score`/`reports:enrich`/`reports:embed` scripts, internal rescan endpoint, `risk:seed-demo`, Docker atlas-local.
5. **Investigation**: LangGraph graph, lane tools, budget/TPM enforcement, tracing, runner, SSE stream, recommendations catalog, approve/dismiss/feedback/what-if.
6. **Admin console**: layout, sidebar/header extensions, shared blocks and charts, then every page in §11 with client tests.
7. **Admin assistant**: loop, tools, cards, evidence guard, numeric check, refusals, UI page.
8. **Docs**:
   - README: feature, admin console, architecture, security, env vars, API reference, data models, known gaps, route count;
   - `.env.example`, Docker/Cloud Run docs;
   - `docs/early-warning/ARCHITECTURE.md`, written from the shipped code.

---

## 14. Tests (no network, no keys)

Mocks follow the existing suites: `jest.mock('../../ai/groqClient')`, `createFakeChatModel`, a mocked `youtubeService`, a `fetch` spy for Google. Graph models are injected through a `fakeGraphModels` helper, and vector search is mocked at `semanticSearch`.

- **Golden**: robust-z, `scoreWindow`, levels, attribution, slopes, percentile, clustering vs `ewdi-golden.json`.
- **Reports**:
  - Quota: 429 **before multer runs**, asserted by a spy that multer is never reached and no upload file is written. The parallel race is covered by the unique slot.
  - Saved when enrichment throws.
  - Voice returns 400 `VOICE_DISABLED` and the UI hides the recorder.
  - Resolve sends one notification per student; a second resolve sends none; concurrent resolves send exactly one.
  - Ownership, validation and attachment signature checks.
- **Escalation**: one alert per episode, plus one on HIGH→CRITICAL; rescans are idempotent; lifecycle new→ongoing→escalated→resolved (one precedent)→recurring; cold start uses fixed thresholds.
- **Graph**:
  - LOW/MEDIUM makes zero model calls (the fake asserts it was never called).
  - HIGH opens the lanes.
  - An uncited hypothesis is capped at 0.35.
  - Revise happens at most once.
  - `need_more_evidence` goes back to the supervisor.
  - A total outage gives a degraded but cited assessment.
  - Budget exhaustion stops cleanly.
  - Approve calls the same service spy as the console control and writes an audit entry; a double approve returns 409.
- **Admin auth**:
  - A non-admin gets 403 and no token.
  - A demoted or suspended admin gets 401 on the next request.
  - Superadmin-only actions are enforced.
  - The last superadmin is protected.
  - A suspended student gets 403 `ACCOUNT_SUSPENDED`.
  - A student token is rejected on `/api/admin/*` and an admin token on student routes.
- **Settings and gateways**:
  - DB > env > default.
  - Validation returns 400.
  - A cross-instance version bump is picked up after the TTL.
  - A disabled feature returns a friendly 503.
  - The USD cap blocks non-essential features and the quota returns 429.
  - No key value appears in any response.
  - Failover on daily 429 while per-minute 429 still waits.
  - Model calls are logged for existing features (for example notes chat).
- **Assistant**:
  - The guard forces a tool call.
  - Numeric check.
  - Mutating tools only create cards; confirm executes once and audits.
  - Forbidden requests are refused.
- **Semantic**: the `$text` fallback returns results; the `$vectorSearch` pipeline shape is correct; clustering is stable; an embedding failure never blocks a report.
- **Every new endpoint**: auth, ownership, validation.
- **Client** (RTL, `MemoryRouter`, mocked `lib/api` or `lib/adminApi`):
  - the report dialog and entry points;
  - the bell;
  - the admin route guard;
  - the risk board;
  - the live run with a mocked `ReadableStream` SSE (as in `agentStream.test.js`);
  - the gateway settings form;
  - the console renders `Sidebar` and `Navigationinner` (the same shell).

---

## 15. Verification (end to end)

1. `npm test` and `npm run lint` from the repo root (server Jest plus client CRA tests) after every phase.
2. `docker compose up --build` with atlas-local, then `npm run db:vector-index --prefix server` (must succeed locally).
3. **Demo walk-through** (also the hand-off script):
   1. `SUPERADMIN_EMAILS=you@…`
   2. `npm run risk:seed-demo --prefix server -- --area video-summarizer --student you@…`
   3. Sign in at `/admin/login`.
   4. The risk board shows Video Summarizer HIGH/CRITICAL and an alert banner.
   5. Run the investigation and watch the live view (nodes light up).
   6. The alert detail shows cited reports and `MC-` calls plus the verifier verdict.
   7. Approve "known issue banner", then check the student tool shows it and the audit log has the entry.
   8. Resolve the reports with a note.
   9. Sign in as the student: the bell shows one notification.
   10. `--clear`.
4. A live Groq run of one investigation and one assistant turn, against in-memory Mongo and your key, to check TPM behaviour and the strict-schema issues from your memory note. This spends a few cents of your Groq quota, and I'll ask before running it.
5. Kill switch: set `GROQ_API_KEY=invalid`, run an investigation → degraded, statistics-only result; student tools show friendly errors.

---

## 16. Defaults I picked (change any at approval)

| Topic | Default |
|---|---|
| Area ids | The 13 in §2 |
| Quota | 2 open reports per area |
| Min daily reports / calls | 3 / 20 |
| Fixed levels | 0.50 / 0.82 / 0.95 |
| Cold start | < 7 active baseline days |
| Percentile levels | Need ≥ 120 scored windows |
| Semantic minimum vectors | 30 |
| Clustering | τ 0.75, `min_cluster` 3 |
| Budget | 40k tokens / $0.03 per run, 2 lanes at a time, 3 loops, 1 revision |
| Assistant | $0.01 per turn, 5 steps |
| Retention | `ModelCall`/`GatewayEvent` TTL 45 days |
| Alert banner | 20 s poll |
| Auto-investigate on schedule | Off |
| Per-student AI quota and global USD cap | 0 (off), so behaviour is unchanged until an admin sets them |
| Superadmin-only settings | USD cap, rate limits, whole-app maintenance, investigation budgets |
| Emails | Masked everywhere; reveal is audited |
| Verifier | Gemini when configured, otherwise gpt-oss-20b |

## 17. Open questions (none block starting Phase 1)

1. **Groq fail-over and pricing.** I'll default the chains to the two models you already use (gpt-oss-120b ↔ gpt-oss-20b) and approximate prices. If your key can reach others (for example `llama-3.3-70b-versatile`), tell me and I'll add them to the chain.
2. **Cloud Run CPU.** Background investigations need CPU after the 202 response. Options:
   - (a) `--no-cpu-throttling` on the server (costs more);
   - (b) rely on the open live-view SSE request keeping the instance active (a run can stall if nobody watches).

   I'll document both, default to (b), and mark stalled runs `interrupted`.
3. **Local Mongo volume.** atlas-local runs mongod 8 against your existing `mongo:7.0` volume. The 7→8 upgrade path is supported, but I'll test it on a **copy** of the volume first and never touch the real one. If it fails, the docs will give a `mongodump`/`mongorestore` step.
4. **Uploads on Cloud Run** (screenshots, voice, PDFs) go to local disk, like today's notes PDFs, so they're ephemeral. I'm not adding GCS in this task; it goes under known gaps unless you want it.

## Left out on purpose

- The CartX shop and orders, the Twitter pipeline, .eml intake, PII vault/tokenisation (Novard stores student reports by email as it already does for everything else), XGBoost/YOLO, and EWDI's look.
- A thumbs-down UI. The "Report this answer" action is the per-message signal, and `ai_report_rate` is the feature.
