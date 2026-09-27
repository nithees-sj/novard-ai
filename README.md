# Novard-AI

**An AI-driven career development and learning platform built on the MERN stack.**

Novard-AI bundles career planning, self-paced learning, document/video comprehension and a community Q&A forum into one application. Nearly every feature is backed by a large language model — Groq (gpt-oss) for text generation and Google Gemini for course discovery — so plans, quizzes, summaries and answers are generated on demand rather than pulled from a fixed catalogue.

<p align="center">
  <img src="NOVARD_AI_SYSTEM_ARCHITECTURE.png" alt="Novard-AI system architecture" width="820">
</p>

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Security](#security)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Testing, linting and building](#testing-linting-and-building)
- [Environment Variables](#environment-variables)
- [Running with Docker](#running-with-docker)
- [Deploying to Google Cloud Run](#deploying-to-google-cloud-run)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Project Structure](#project-structure)
- [Known Gaps](#known-gaps)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Authentication & profile

Sign-in is **Google OAuth 2.0** through `@react-oauth/google` (implicit flow). The browser sends the Google access token to `POST /api/auth/google`; the API asks Google whether the token is valid, was issued to *this* app's OAuth client and belongs to a verified email, creates the account on first sign-in, and returns a signed **session token** (JWT, 7 days by default). The client keeps it in `localStorage` ([lib/session.js](client/src/lib/session.js)) and sends it as `Authorization: Bearer …` on every request ([lib/api.js](client/src/lib/api.js)); when the API answers 401 the student is signed out. Every application route in [App.js](client/src/App.js) is guarded — unauthenticated visitors are redirected to the landing page. Users can extend their profile with a mobile number and bio from the Profile page.

### Career development hub (`/career`)

Two tools rendered inline in a single workspace:

| Tool | What it does |
| --- | --- |
| **Smart Roadmap** | AI-generated, personalised roadmaps: the student picks a target role, starting level, hours per week, timeline, skills they already have and a goal. The result is a stage-by-stage plan drawn as a Mermaid flow diagram (zoom, full screen, SVG download), with per-topic explanations, tutorial searches, a project per stage and milestones. Every roadmap is saved. The original 12 pre-drawn roadmaps remain as references, each with a one-click "generate a personalised version". |
| **Skill Gap Analysis** | A coaching chatbot. A short intake (target role, current skills, background, hours per week, goal) produces a gap report: the skills the role needs, which ones the student already has, and the missing ones ranked by priority with effort and a first step. The estimated readiness is *computed* from that list (core skills count double). The student then chats with a coach that knows their profile and gaps: short conversational answers by default, full plans when asked, with suggested questions based on their top gaps. Every conversation is saved per student. |


### Skill Unlocker (`/skill-unlocker`)

The most involved module. You describe a skill, a duration (minimum 10 days), your level (beginner/intermediate), focus areas, preferred language and teaching style. The backend then:

1. Prompts gpt-oss-120b for a structured day-by-day JSON curriculum — topic, objective and a suggested video title per day.
2. Searches YouTube for each suggested title via **youtubei.js (Innertube)**, attaching a real `videoId`, title and thumbnail to every day (falling back to a search URL when nothing matches).
3. Persists the plan so progress survives sessions.

From there you can tick days complete, regenerate a single day's video if the match was poor (`refresh-video`), generate a configurable quiz (5–20 questions, beginner/intermediate/advanced) scoped to the days you have actually finished, and keep a history of every quiz attempt with score and completion date.

### Notes: chat with your PDFs (Doubts & Learning → Notes & Quiz)

Upload a PDF (10 MB cap, PDF-only filter). The text is extracted with `pdf-parse` v2 (current pdf.js), chunked to fit the model context, and stored. You can then:

- **Chat** with the document — questions are answered from the extracted text, with full chat history retained per note.
- **Summarize** it — long documents are summarized chunk-by-chunk and then consolidated.
- **Generate a quiz** from the content, submit answers, and store a scored result (correct / total / percentage).

### Video Sessions (`/video`)

Three sub-tools behind one page:

- **Video Library** — describe what you want to learn and pick a platform (YouTube, Udemy, Coursera, edureka). YouTube results come from live search; Udemy/Coursera/edureka listings are produced by **Gemini Flash** with heavy prompt constraints pushing it toward real, still-live course URLs.
- **Video Summarizer** (Video Sessions → Video Summarizer) — paste a YouTube URL. The caption track (English preferred) is downloaded through Innertube's iOS client and used as the transcript; title and description come from the video metadata. Videos without captions fall back to title + description. You then get chat-over-transcript, summarization (long transcripts are sampled from start to end) and quiz generation with saved results.

### Doubts & Learning (`/doubts`)

- **Notes & Quiz** — entry point into the notes workflow above.
- **Doubt Clearance** (Doubts & Learning → Doubt Clearance) — describe the doubt (plus an optional image link) and the tutor answers straight away. The AI writes a short, specific title from the question ([services/doubtTitle.js](server/services/doubtTitle.js)), so the list and heading name the exact concept instead of repeating the description. `node scripts/retitleDoubts.js` retitles older doubts and keeps each old title in `previousTitle`. Then hold a threaded conversation with the assistant. Responses are formatted for readability (code blocks, structured explanations). Each doubt can be summarized, turned into a quiz (with a content-aware fallback generator when the model returns unparseable JSON), and enriched with **YouTube video recommendations** that include a per-video reason for the suggestion.

### AI Forum (`/forum`)

A Stack Overflow-style Q&A board:

- Every post has a **category** (General, Tutorial, Urgent, Ideation, Showcase) and a separate **status** (Active, Solved, Closed).
- **Category, status, search and sort all combine** on the server: Latest, Most upvoted, Most discussed, Oldest, Title A–Z. Results are paginated, and "Load more" fetches the next page.
- **Only the author can mark a discussion solved, close it, reopen it or delete it.** The server rejects the same request from anyone else with a 403, and deleting a discussion also removes its replies. Closed discussions don't accept new replies.
- **AI participation:** the assistant answers every new discussion and every reply in the background, so posting never waits on the model. Its answers are Markdown (headings, lists, code, tables) and appear nested under the comment they answer, rather than wherever they happen to land in time order.
- Up/down voting on posts and comments.

### Dashboard analytics (`/home`)

[analyticsService.js](server/services/analyticsService.js) turns what the student has actually done into deterministic numbers. These come from quiz answers, skill-plan days completed, questions asked and material studied. The same data always gives the same result:

- **Skill Score** (0–1000) is built from four parts:
  - mastery: quiz accuracy, weighted by recency;
  - progress: skill-plan days completed;
  - consistency: active days in the last 30;
  - breadth: distinct materials studied.

  The dashboard shows the change against the same score a week ago.
- **Quiz accuracy** is weighted by question count and recency. **Plan completion** is the share of plan days completed. The **study streak** follows the student's own timezone.
- **Study time** for the last 7 days is charted. It is the real time spent in the app, recorded by [useStudyTimeTracker](client/src/hooks/useStudyTimeTracker.js) on every page:
  - time counts only while the tab is visible and focused, and while the student has used the mouse, keyboard or touch in the last 5 minutes, or is watching a video;
  - the tracker saves about once a minute, and again when the tab is hidden or closed;
  - the dashboard updates live as time is saved;
  - each day shows the larger of the tracked time and an estimate from saved activity (both are lower bounds on the real time). Days from before tracking existed show only the estimate, drawn lighter and labelled "estimated".
- Every AI chat counts as activity, including the Skill Gap coach and the Novard Agent. Generating a roadmap counts too.
- A **subject proficiency radar** covers the student's own subjects, and a **strengths vs. needs-practice** list covers topics with at least 5 answered questions.

### Profile (`/profile`)

[profileController.js](server/controllers/profileController.js) reuses the same activity model, so the profile and the dashboard always agree. The page shows:

- **Identity card**: photo, name, email, mobile, bio, member-since and last-active date. The current goal comes from the newest skill-gap analysis or roadmap: target role, readiness, weekly hours and skills. The student edits their details inline.
- **Overview tiles**: skill score, quiz accuracy, tests taken, estimated study time, streak, and questions asked across every AI chat.
- **Activity**:
  - the skill score over the last 12 weeks;
  - where study time went, as a donut chart;
  - a 52-week study calendar heatmap;
  - counts of notes, videos, doubts, plans, roadmaps and chats.
- **Tests**: every submitted quiz from Notes, the Video Summarizer, Doubts and skill plans. Includes a score trend, a score spread, accuracy by section and by chosen difficulty, and a filterable history table.
- **Learning path**: skill plans with day progress and the next topic, roadmaps with their stages, and skill-gap analyses with readiness and top gaps.
- **Subject mastery**: the proficiency radar and strengths and weaknesses.

The charts are small SVG components written for this app ([components/profile/charts.jsx](client/src/components/profile/charts.jsx)); no chart library is used.

### Everywhere else

- A floating **Novard Agent** button available across the app (see [Novard Agent](#novard-agent) below).
- Markdown rendering (`react-markdown` + GFM, with Mermaid diagrams) for all AI output.
- Tailwind layouts with a persistent sidebar. Every student page is reachable from it:
  - Home, Profile and Settings;
  - Career Development (Smart Roadmap, Skill Gap Analysis);
  - Doubts & Learning (Notes & Quiz, Doubt Clearance);
  - AI Forum;
  - My Learning (Skill Unlocker);
  - Video Sessions (Video Library, Video Summarizer).

  Tools inside a hub can be linked directly with `?tool=` and `?open=<id>` ([lib/openParam.js](client/src/lib/openParam.js)). The old standalone pages were removed. Their URLs (`/roadmap`, `/skills-required`, `/doubt-clearance`, `/notes`, `/youtube-video-summarizer`, `/youtube-videos`) redirect to the same tool inside its hub.

---

## Architecture

```
┌──────────────────────┐        ┌───────────────────────────┐
│  React 18 SPA        │ HTTPS  │  Express API (63 routes)  │
│  CRA + Tailwind      │ Bearer │  routes → controllers →   │
│  react-router v6     ├───────►│  services → Mongoose      │
│  Google OAuth (impl.)│ token  │  JWT sessions, rate limits│
└──────────────────────┘        └─────────┬─────────────────┘
                                          │
              ┌───────────────────────────┼──────────────────────────┐
              ▼                           ▼                          ▼
      ┌───────────────┐          ┌─────────────────┐        ┌────────────────┐
      │ MongoDB Atlas │          │ Groq (gpt-oss)  │        │ YouTube        │
      │ 12 collections│          │ Gemini Flash    │        │ (Innertube +   │
      └───────────────┘          └─────────────────┘        │  search API)   │
                                                            └────────────────┘
```

**Model routing.** Every model ID lives in [server/config/ai.js](server/config/ai.js) — the previous IDs were hard-coded in ~30 places and all broke at once when Groq retired the Llama 3.x family.

| Role | Model | Used for |
| --- | --- | --- |
| `MODELS.REASONING` | `openai/gpt-oss-120b` | Curriculum generation, quiz authoring, doubt clearance, forum answers. |
| `MODELS.FAST` | `openai/gpt-oss-20b` | Notes chat, summarization, video Q&A. |
| `MODELS.GEMINI` | `gemini-flash-latest` | Third-party course discovery only. If it is overloaded (503) or rate-limited (429), it is retried once and then `MODELS.GEMINI_FALLBACKS` (default `gemini-flash-lite-latest`; set with `GEMINI_FALLBACK_MODELS`) is used ([ai/gemini.js](server/ai/gemini.js)). |

Each can be overridden with `GROQ_MODEL_REASONING`, `GROQ_MODEL_FAST` or `GEMINI_MODEL` without touching code. The gpt-oss models are *reasoning* models: they spend completion tokens on an internal `reasoning` field before emitting `content`, so every Groq call sends `reasoning_effort: "low"` to keep the token budget available for the answer.

**Server layers.** A request passes through [app.js](server/app.js) (security headers, CORS, JSON body limit, global rate limit) to a router in [routes/](server/routes/), which applies `requireAuth()` and, for AI-backed endpoints, the per-student AI rate limit. Controllers in [controllers/](server/controllers/) only translate HTTP: they read the request, take the student's id from the session, call a service and shape the response. Business logic and data access live in [services/](server/services/) (the Novard Agent's in [agent/](server/agent/)), and every error — thrown anywhere — is turned into one JSON format by [middleware/errorHandler.js](server/middleware/errorHandler.js):

```json
{ "error": "A message for the student", "code": "BAD_REQUEST", "details": "optional" }
```

---

## Security

- **Authentication.** Every route except `GET /health`, `GET /` and `POST /api/auth/google` requires a valid session token ([middleware/auth.js](server/middleware/auth.js)). Google tokens issued to any other OAuth client are rejected.
- **Authorization.** The student's id always comes from the session. Routes that still carry a user id in the URL or body (kept for compatibility) must match it, or the request is refused with 403. Every read, update and delete of a note, doubt, video, plan, roadmap, analysis or chat is scoped to its owner; forum posts and replies are attributed to the signed-in student, and only the author can change a discussion's status or delete it.
- **Input validation.** Ids must be valid ObjectIds (which also blocks `{"$ne": …}`-style operator injection), text fields are length-bounded, numbers are range-checked, uploads must really be PDFs (the file signature is checked, not just the MIME type), and links that come from model output must be `http(s)`.
- **Rate limiting** ([middleware/rateLimit.js](server/middleware/rateLimit.js)): 300 requests/min per IP, 30 AI requests/min per student, 30 sign-in attempts per 15 min per IP (all configurable).
- **Headers & CORS.** `helmet` sets standard security headers; `CORS_ORIGINS` restricts which sites may call the API. Sessions are bearer tokens, not cookies, so there is no CSRF surface.
- **XSS.** AI output is rendered by `react-markdown` without raw HTML, and Mermaid runs with `securityLevel: 'strict'`.

---

## Conversational AI (LangChain)

Every chat in the app runs on one LangChain conversation engine,
[server/ai/conversation.js](server/ai/conversation.js):

| Chat | Memory stored on |
| --- | --- |
| Novard Agent | `ChatbotConversation.messages` (with each message's action cards) |
| Notes | `Notes.chatHistory` |
| Video Summarizer | `YouTubeVideo.chatHistory` |
| Doubt Clearance | `DoubtClearance.chatHistory` |
| Skill-gap coach | `SkillGapSession.messages` |

- **Chain:** `ChatPromptTemplate` (system instructions, `MessagesPlaceholder('history')`, then the new message) piped into `ChatGroq` and a `StringOutputParser`, wrapped in `RunnableWithMessageHistory`.
- **History store:** `MongoChatHistory`, a `BaseListChatMessageHistory` that reads and writes the chat array already stored on each document. Messages are appended with an atomic `$push`, and a turn is saved only after the model answers.
- **Summary-buffer memory:** recent turns go to the model word for word. Once the unsummarised part of a chat passes `MEMORY_SUMMARIZE_AT_TOKENS` (default 10,000), the older turns are folded into a running summary saved in the document's `memory` field, keeping about `MEMORY_KEEP_RECENT_TOKENS` (default 6,000) verbatim. The student can keep asking about anything earlier in the chat, and long chats never overflow the model.
- **Forum:** the AI participant uses the same LangChain pieces with the thread as its history. Human comments are labelled with the author's name, so replies can build on the whole discussion.

- **Rate limits:** Groq's free tier allows about 8,000 tokens per minute per model. When a request is refused with "try again in N s" (up to 30 s), every chat waits and retries automatically. The Novard Agent shows "The AI is busy - continuing in N s…" while it waits. The student never sees a raw provider error.

## Novard Agent

The assistant behind the floating button (`/chatbot`) is an **agent**: it teaches, and it can do things in the app for the student, always after asking.

**Layout.** It is laid out like ChatGPT or Claude:
- **Left:** a sidebar with *New chat* (Ctrl+Shift+O), search, and the chat history grouped by Today, Yesterday, Previous 7 days and so on. Each chat can be renamed or deleted.
- **Centre:** the conversation. Replies stream in word by word, with a Stop button. Assistant messages have a Copy button, and there is a jump-to-latest button when you scroll up.
- **Other touches:** each chat gets an AI-written title, the empty screen offers starter prompts, and on phones the history becomes a drawer.

**How a turn works** ([agent/novardAgent.js](server/agent/novardAgent.js)): it is a LangChain tool-calling loop on `ChatGroq`, with at most 5 model calls per turn.
- **Read tools** run immediately:
  - `get_my_workspace` returns the student's doubts, videos, roadmaps, plans with progress, skill-gap results and recent quiz scores;
  - `search_youtube_videos` searches YouTube.
- **Questions and tasks are handled differently.** Every action has two tools:
  - **A question** ("what is Docker?", "how do I become a DevOps engineer?") gets a full answer plus ONE **suggestion** from a `propose_*` tool. It appears as a card with *Yes* / *No thanks*, and nothing is created until *Yes*. If the model forgets to suggest after a real learning question, one small extra call adds the suggestion (or none, if nothing fits or the student declined it before).
  - **A command** ("create a doubt about…", "fetch me a video on…", "make me a roadmap for…", or "yes" to a suggestion) runs at once with the matching do tool (`create_doubt`, `add_video`, `generate_roadmap`, `create_skill_plan`, `run_skill_gap_analysis`, `post_to_forum`). Commands are recognised in code (a create/add/make… verb plus a doubt/video/roadmap/plan… object, "yes" to a suggestion, or the answer to the agent's clarifying question). For a command:
    - the model is told to do it or ask the one missing detail, and suggestion cards are refused;
    - its text is held back instead of streamed;
    - once the task has run, the reply is a fixed confirmation ("Done! I've created the doubt "…" in Doubt Clearance.") with no further model call. A command never turns into an explanation.
  - **Vague tasks get one question.** "Create a doubt about Docker" makes the agent ask which concept (images, volumes, networking…), then create it from the answer. Only the essential detail is ever asked for: the concept, the role or the skill. Level, hours and timeline are inferred.
  - **A question can never create something by itself.** Do tools are refused unless the student's message, or their previous one, is actually a request (create, add, fetch, make, yes…).
  - **Old suggestions are retired.** When a task is done, any earlier unanswered suggestion of the same kind is marked *Replaced*.

  What each action does:

| Card | What *Yes* does | Opens |
|------|-----------------|-------|
| Save as a doubt | Creates a doubt in Doubt Clearance, already containing the agent's explanation | `/doubts?tool=doubts&open=<id>` |
| Add a video | Adds the chosen YouTube video (from a real search) to Video Summarizer | `/video?tool=summarizer&open=<id>` |
| Generate a career roadmap | Generates a Smart Roadmap for the role, marking skills the student already knows | `/career?tool=roadmap&open=<id>` |
| Create a learning plan | Builds a day-by-day Skill Unlocker plan with a video per day | `/skill-unlocker?open=<id>` |
| Analyse your skill gap | Runs a Skill Gap analysis and opens the coaching chat | `/career?tool=skills&open=<id>` |
| Start a forum discussion | Posts to the AI Forum (the forum AI replies as usual) | `/forum?open=<issueId>` |

- **Same code as the pages:** each action calls the same function the page uses (`createDoubt`, `addYouTubeVideo`, `createRoadmapFor`, `createSkillPlan`, `startSession`, `openIssue`), so an item the agent creates is identical to one made by hand. Cards go from *needs your OK* → *working* → *done* (with an Open button), or *failed* with *Try again*.
- **No duplicates:** a card is claimed atomically, so a double click never creates two items.
- **Memory:** the agent remembers the whole conversation through the same summary-buffer memory as every other chat, including which cards it offered and whether the student accepted or declined them. So "make that roadmap intermediate instead" or "what did you suggest earlier?" work.
- **Safeguards:**
  - the model's arguments are cleaned and bounded, and video ids must come from a real search, never invented;
  - at most 2 proposals per turn;
  - if a reply says "confirm below" without calling a tool, one extra call recovers the card or removes the sentence.

Other pages can open the agent with a question already sent: *Start Mock Interview* (Career) and *Explore New Topics* (Doubts & Learning) do this with `navigate('/chatbot', { state: { prompt } })`.

Routes:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/agent/chat` | `{userId, userName?, message, conversationId?}`. Streams Server-Sent Events: `meta`, `token`, `status`, `action`, `title`, `done`, `error`. |
| `POST` | `/api/agent/conversations/:id/actions/:actionId` | `{userId, decision: "confirm" \| "dismiss"}`: runs or declines a card. |
| `GET` | `/api/agent/conversations/user/:userId` | Chat history list. |
| `GET` | `/api/agent/conversations/:id?userId=` | One chat with its messages and cards. |
| `PATCH` | `/api/agent/conversations/:id` | Rename (`{userId, title}`). |
| `DELETE` | `/api/agent/conversations/:id?userId=` | Delete a chat. |

## Personalised roadmaps

[server/services/roadmapService.js](server/services/roadmapService.js) asks the model for a
**structured** roadmap (stages, then topics, then a project for each stage), never for Mermaid.
The server then:
- validates the result: 4–7 stages, 3–6 topics each, and any stage with too few topics is dropped;
- rescales stage lengths to the timeline the student chose;
- marks topics the student already knows, using whole-word matching (knowing "C" does not mark "CSS");
- builds the diagram in code (`buildRoadmapMermaid`), so it is always valid Mermaid with a consistent layout: start, one row per stage, then goal. Core topics are blue, optional ones dashed, already-known ones green, and projects magenta.

The diagram is rebuilt every time a roadmap is read, so styling changes apply to older
roadmaps too. Resources are YouTube *search* links built from model-suggested queries, not
URLs written by the model, which can be invented.

Routes: `POST /api/roadmaps/generate`, `GET /api/roadmaps/user/:userId`,
`GET /api/roadmaps/:id?userId=`, `DELETE /api/roadmaps/:id`.

## Skill-gap coach

[server/services/skillGapService.js](server/services/skillGapService.js) makes one structured call
to list the skills the target role needs and mark which ones the student already has. A skill the
student listed always counts as held (whole-word match), even if the model misses it. Readiness is
then calculated from that list rather than taken from the model. The opening chat message is built
from the analysis, so it costs no extra model call.

Every reply after that is grounded in the student's profile and gaps. Replies are short and
conversational by default and switch to structured Markdown only when the student asks for a plan
or a comparison.

Sessions are stored per student in `SkillGapSession`. Routes:
`POST /api/skill-gap/sessions`, `GET /api/skill-gap/sessions/user/:userId`,
`GET /api/skill-gap/sessions/:id?userId=`, `POST /api/skill-gap/sessions/:id/messages`,
`DELETE /api/skill-gap/sessions/:id`.

## Customised quizzes

Every quiz — Notes, Video Summarizer, Doubt Clearance and Skill Unlocker — starts from
the same setup screen ([QuizSetup.jsx](client/src/components/quiz/QuizSetup.jsx)):

- **Your previous marks on this topic:** attempts, best, average and latest (with the
  change since the one before), plus each past attempt with its date, score and the
  settings it used. Only quizzes that were actually submitted count, following the
  same rules as the dashboard.
- **Options:** difficulty (Beginner / Intermediate / Advanced), number of questions
  (5, 10, 15, 20 or any value from 5 to 20), question style (Conceptual / Practical /
  Mixed), and an optional focus sub-topic. These start from the student's last choices
  on that topic.

All four sections generate through one service
([server/services/quizService.js](server/services/quizService.js)). It:

- returns exactly the number of questions asked for, with a follow-up request if the
  model returns too few;
- validates every question (4 distinct options, one correct answer, an explanation);
- shuffles the options, because models put the answer in the first two positions far
  more often than chance;
- samples long documents from start to end instead of reading only the first chunk.

Past marks come from `GET /api/quiz-history/:source/:itemId?userId=`.

## How summaries and chat replies are rendered

Every piece of model output in the app — summaries, chat replies, generated skills,
projects and resumes — is rendered by one component,
[`MarkdownView`](client/src/components/MarkdownView.jsx): `react-markdown` with
`remark-gfm` for tables, task lists and strikethrough.

Summary prompts additionally require **one Mermaid flowchart** per summary. The rules
live in [server/config/prompts.js](server/config/prompts.js) and are deliberately
strict, because models break the Mermaid parser in the same few ways every time
(unquoted labels containing punctuation, the reserved word `end` used as a node id).
A ```mermaid fence is rendered as an SVG by
[`MermaidDiagram`](client/src/components/MermaidDiagram.jsx), which imports mermaid
on demand so the ~480 kB library never enters the initial bundle. If a model does emit
an invalid diagram, that block falls back to a plain code block rather than taking the
summary down with it.

This replaced three separate approaches: raw `{summary}` text (which showed `###` and
`**` literally), a sentence-splitting card builder that destroyed tables and lists, and
`StructuredMessageRenderer` — a ~180-line regex parser duplicated across three files
with no table support. `dangerouslySetInnerHTML` no longer appears anywhere in the
client; react-markdown is configured without `rehype-raw`, so raw HTML in model output
is inert text rather than something that has to be sanitised.

## Tech Stack

**Frontend** — React 18.3, React Router 6 (route-level code splitting), `@react-oauth/google`, Axios, Tailwind CSS 3 + `@tailwindcss/typography`, `react-markdown` + `remark-gfm`, `mermaid` (lazy-loaded), `react-icons`, Create React App (`react-scripts` 5).

**Backend** — Node.js 20, Express 4, Mongoose 8, LangChain (`@langchain/core`, `@langchain/groq`), `groq-sdk`, `@google/generative-ai`, `youtubei.js`, `youtube-search-api`, `pdf-parse`, Multer, `jsonwebtoken`, `helmet`, `express-rate-limit`, CORS.

**Quality** — Jest + Supertest + `mongodb-memory-server` (server), Jest + React Testing Library (client), ESLint on both.

**Infrastructure** — MongoDB Atlas, Docker + Docker Compose, Nginx (client image), Google Cloud Run + Artifact Registry + Cloud Build, Vercel (client-only SPA deploy via [vercel.json](vercel.json)).

---

## Getting Started

### Prerequisites

- Node.js 20.16+ (the server uses `pdf-parse`, which needs it)
- A MongoDB instance (Atlas connection string, or local/Docker MongoDB)
- A [Groq API key](https://console.groq.com)
- A Google OAuth 2.0 Client ID (Web application) with your dev origin (`http://localhost:3000`) in its **Authorized JavaScript origins**
- Optional: a Google AI (Gemini) API key — used only for Udemy/Coursera/Edureka course discovery

### Install

```bash
git clone <your-fork-url> novard-ai
cd novard-ai
npm run install:all          # installs server/ and client/
```

### Configure

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Then fill in at least `MONGO_URI`, `GROQ_API_KEY`, `GOOGLE_CLIENT_ID` and `JWT_SECRET` in `server/.env`, and `REACT_APP_API_ENDPOINT` and `REACT_APP_GOOGLE_CLIENT_ID` in `client/.env`. `GOOGLE_CLIENT_ID` (server) and `REACT_APP_GOOGLE_CLIENT_ID` (client) must be the same value. Generate a `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Run

```bash
# Terminal 1 — API on :5000 (restarts on file changes)
npm run dev:server

# Terminal 2 — React dev server on :3000
npm run dev:client
```

Open <http://localhost:3000>. `GET /health` reports `{ "status": "OK", "database": "up" }` when the API and its database are ready. Use `npm start --prefix server` to run the API without file watching.

---

## Testing, linting and building

| Command (from the repo root) | What it does |
| --- | --- |
| `npm test` | Server tests, then client tests. |
| `npm test --prefix server` | Unit + API tests. Each API test file runs against its own in-memory MongoDB; the AI providers and YouTube are mocked, so no keys or network are needed. The first run downloads a MongoDB binary (~120 MB). |
| `npm run test:coverage --prefix server` | The same, with a coverage report. |
| `npm run test:ci --prefix client` | Client tests once (use `npm test --prefix client` for watch mode). |
| `npm run lint` | ESLint on server and client. |
| `npm run build` | Production build of the client into `client/build/`. |

The server test suites cover every endpoint's authentication, ownership and validation rules, each feature's workflow (notes, doubts, videos, video library, forum, learning plans, roadmaps, skill-gap coach, analytics, profile, study time, the Novard Agent's turn loop and action cards) and the business logic behind them (quiz validation, analytics scoring, roadmap and readiness maths, transcript parsing, JSON recovery from model output).

---

## Environment Variables

### Server

See [server/.env.example](server/.env.example) for a commented template.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | yes | MongoDB connection string. |
| `GROQ_API_KEY` | yes | Powers every Groq-backed feature. |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth client ID(s), comma-separated, whose sign-ins the API accepts. Same value as the client's `REACT_APP_GOOGLE_CLIENT_ID`. |
| `JWT_SECRET` | yes in production | Signs session tokens. In development a random secret is used when unset (everyone is signed out on restart). Changing it signs everyone out. |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | optional | Gemini, used only for Udemy/Coursera/Edureka course discovery; without it the built-in course list is used. |
| `PORT` | no | Defaults to `5000`; container images default to `8080`. |
| `NODE_ENV` | no | `production` enables JSON logs and `TRUST_PROXY=1`, and makes `JWT_SECRET` mandatory. |
| `JWT_EXPIRES_IN` | no | Session lifetime, default `7d`. |
| `CORS_ORIGINS` | no | Comma-separated browser origins allowed to call the API. Unset = any origin (a warning is logged in production). |
| `TRUST_PROXY` | no | Proxy hops in front of the API (default `1` in production), so rate limits see the real client IP. |
| `UPLOAD_DIR` | no | Where uploaded PDFs are stored, relative to `server/` (default `uploads`). |
| `RATE_LIMIT_API_PER_MINUTE` / `RATE_LIMIT_AI_PER_MINUTE` / `RATE_LIMIT_AUTH_PER_15_MIN` | no | Rate limits (defaults 300 / 30 / 30). |
| `LOG_LEVEL` / `LOG_FORMAT` | no | `error`, `warn`, `info`, `debug` or `silent`; `LOG_FORMAT=json` forces JSON lines. |
| `GROQ_MODEL_REASONING`, `GROQ_MODEL_FAST`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | no | Model overrides (see [config/ai.js](server/config/ai.js)). |
| `MEMORY_SUMMARIZE_AT_TOKENS`, `MEMORY_KEEP_RECENT_TOKENS` | no | When chat memory is summarised (see [Conversational AI](#conversational-ai-langchain)). |

> The server refuses to start if `MONGO_URI`, `GROQ_API_KEY`, `GOOGLE_CLIENT_ID` or (in production) `JWT_SECRET` is missing.

### Client

Create React App inlines `REACT_APP_*` values **at build time**, not at runtime — a container must be rebuilt (or built with the right `--build-arg`) to change them. Template: [client/.env.example](client/.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `REACT_APP_API_ENDPOINT` | yes | Base URL of the Express API. |
| `REACT_APP_GOOGLE_CLIENT_ID` | yes | Google OAuth 2.0 Web client ID. |

---

## Running with Docker

The development stack ([docker-compose.yml](docker-compose.yml)) brings up three containers — MongoDB 7, the API, and the React build served by Nginx:

```bash
export REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
docker compose up --build
```

- Client → <http://localhost:3000>
- API → <http://localhost:5001>
- MongoDB → `localhost:27018` (persisted in the `mongodb_data` volume)

Both services declare health checks, and `server/uploads` is bind-mounted so uploaded PDFs survive container restarts.

To smoke-test the production images against an external Atlas cluster, use [docker-compose.prod.yml](docker-compose.prod.yml) — it drops the MongoDB container and reads credentials (including `JWT_SECRET`) from your shell. Full details in [DOCKER_SETUP.md](DOCKER_SETUP.md).

The server image runs as the unprivileged `node` user with `NODE_ENV=production`; only `/app/uploads` is writable.

---

## Deploying to Google Cloud Run

[deploy.sh](deploy.sh) automates the whole path: it authenticates, enables the Cloud Run / Artifact Registry / Cloud Build APIs, creates the registry repo, builds and pushes both images, deploys the server (with `MONGO_URI`, `GROQ_API_KEY`, `GOOGLE_API_KEY` and `JWT_SECRET` from `server/.env`, and `GOOGLE_CLIENT_ID` from `client/.env`), reads back its URL, rebuilds the client with that URL baked in, deploys the client, and finally sets the server's `CORS_ORIGINS` to the client URL.

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=asia-south1   # optional, this is the default
./deploy.sh
```

The client image is a two-stage build (Node build → Nginx) whose config template is expanded with the `PORT` Cloud Run injects. [cloudbuild.yaml](cloudbuild.yaml) covers CI-triggered builds; it only *updates* `NODE_ENV`, `GOOGLE_CLIENT_ID` and `CORS_ORIGINS` (set `_CLIENT_URL`), so set `MONGO_URI`, `GROQ_API_KEY`, `GOOGLE_API_KEY` and `JWT_SECRET` on the service once — ideally as Secret Manager references. Step-by-step manual instructions and troubleshooting live in [CLOUD_RUN_SETUP.md](CLOUD_RUN_SETUP.md).

Remember to add your deployed client URL to the **Authorized JavaScript origins** of your Google OAuth client.

---

## API Reference

Routes live in [server/routes/](server/routes/) (63 in total). Base URL is `REACT_APP_API_ENDPOINT`. Except where marked *public*, every route needs `Authorization: Bearer <session token>`; the `:userId` path segments and `userId` body fields that some routes still accept must be the signed-in student's email. Errors use the format shown under [Architecture](#architecture); AI-backed routes (marked **AI**) share a per-student rate limit.

<details>
<summary><b>Health, sign-in & account</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | *Public.* Liveness probe; reports whether the database is connected. |
| `GET` | `/` | *Public.* Plain-text banner. |
| `POST` | `/api/auth/google` | *Public.* `{accessToken}` from Google → `{token, user}`. Creates the account on first sign-in. |
| `GET` | `/api/auth/me` | The signed-in student's account. |
| `POST` | `/updateUserProfile` | `{name?, mobile?, bio?}` → `{success, user, token}` (a fresh token carrying the new name). |

</details>

<details>
<summary><b>Notes</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/upload-notes` | **AI.** Multipart PDF upload (field `pdf`, 10 MB max) → 201 with the new note. |
| `GET` | `/notes/:userId` | The student's notes (without extracted text). |
| `POST` | `/chat-with-notes` | **AI.** `{noteId, message}` — answer grounded in the note. |
| `POST` | `/summarize-notes` | **AI.** `{noteId}` — chunked summarization. |
| `POST` | `/generate-quiz` | **AI.** `{noteId, difficulty?, questionCount?, style?, focus?}`. |
| `POST` | `/save-quiz-results` | `{noteId, quizId, userAnswers, score: {correct, total}}`. |
| `DELETE` | `/notes/:noteId` | Delete a note and its file. |

</details>

<details>
<summary><b>Video library & summarizer</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/educational-video-requests/:userId` | The student's learning requests. |
| `POST` | `/educational-video-requests` | `{title, description, platform?}` → 201. |
| `DELETE` | `/educational-video-requests/:videoRequestId` | Delete a request. |
| `POST` | `/recommend-educational-videos` | **AI.** `{title, description, platform?}` → `{videos}`. |
| `POST` | `/youtube-videos` | **AI.** `{title, videoUrl}` → 201; fetches metadata and captions. |
| `GET` | `/youtube-videos/:userId` | The student's videos (without transcripts). |
| `POST` | `/chat-with-youtube-video` | **AI.** `{videoId, message}`. |
| `POST` | `/summarize-youtube-video` | **AI.** `{videoId}` (cached after the first run). |
| `POST` | `/generate-youtube-quiz` | **AI.** `{videoId, …quiz options}` → `{quiz, quizIndex}`. |
| `POST` | `/save-youtube-quiz-results` | `{videoId, quizIndex, score}` (number correct). |
| `DELETE` | `/youtube-videos/:videoId` | Delete a video. |

</details>

<details>
<summary><b>Doubt clearance</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/doubt-clearances/:userId` | The student's doubts. |
| `POST` | `/doubt-clearances` | **AI.** `{description, title?, imageUrl?}` → 201 (title written by the AI). |
| `POST` | `/chat-with-doubt-clearance` | **AI.** `{doubtId, message}`. |
| `POST` | `/summarize-doubt-clearance` | **AI.** `{doubtId}` (cached after the first run). |
| `POST` | `/generate-doubt-quiz` | **AI.** `{doubtId, …quiz options}`; needs two exchanges in the chat. |
| `POST` | `/save-doubt-quiz-results` | `{doubtId, quizIndex, score}`. |
| `POST` | `/get-youtube-recommendations` | **AI.** `{doubtId}` → up to 6 videos. |
| `DELETE` | `/doubt-clearances/:doubtId` | Delete a doubt. |

</details>

<details>
<summary><b>Forum</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/forum/issues` | **AI.** `{title, description, category?, tags?}` → 201; the AI's first answer follows in the background. |
| `GET` | `/api/forum/issues` | `?category= &status= &q= &sort= &page= &limit=` |
| `GET` | `/api/forum/issues/:issueId` | One discussion. |
| `PUT` | `/api/forum/issues/:issueId/status` | Author only. `{status: open\|resolved\|closed}`. |
| `DELETE` | `/api/forum/issues/:issueId` | Author only; removes every reply. |
| `GET` | `/api/forum/issues/:issueId/comments` | Replies, oldest first. |
| `POST` | `/api/forum/comments` | **AI.** `{issueId, content, parentCommentId?}` → 201; the AI replies in the background. |
| `POST` | `/api/forum/comments/:commentId/ai-response` | **AI.** An AI reply to one comment. |

</details>

<details>
<summary><b>Skill Unlocker, career tools, analytics</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/skill-unlocker/generate-plan` | **AI.** `{skillName, duration (10-60), description, preferences?}` → 201. |
| `GET` | `/api/skill-unlocker/plans/:userId` | The student's plans with progress. |
| `POST` | `/api/skill-unlocker/toggle-day-completion` | `{planId, dayNumber}`. |
| `POST` | `/api/skill-unlocker/refresh-video` | **AI.** `{planId, dayNumber}` — another video for that day. |
| `POST` | `/api/skill-unlocker/generate-quiz` | **AI.** Quiz on the completed days. |
| `POST` | `/api/skill-unlocker/save-quiz-result` | `{planId, quizId, score (0-100), totalQuestions, …}`. |
| `DELETE` | `/api/skill-unlocker/plans/:planId` | Delete a plan. |
| `POST` | `/api/roadmaps/generate` | **AI.** `{role, level?, hoursPerWeek?, timelineMonths?, knownSkills?, goal?}` → 201. |
| `GET` | `/api/roadmaps/user/:userId`, `/api/roadmaps/:id` | List / open (with its Mermaid diagram). |
| `DELETE` | `/api/roadmaps/:id` | Delete a roadmap. |
| `POST` | `/api/skill-gap/sessions` | **AI.** `{targetRole, currentSkills?, experience?, hoursPerWeek?, goal?}` → 201. |
| `GET` | `/api/skill-gap/sessions/user/:userId`, `/api/skill-gap/sessions/:id` | List / open. |
| `POST` | `/api/skill-gap/sessions/:id/messages` | **AI.** `{message}` → `{userMessage, assistantMessage}`. |
| `DELETE` | `/api/skill-gap/sessions/:id` | Delete an analysis. |
| `GET` | `/api/analytics/:userId` | Dashboard analytics (`?tzOffset=` minutes). |
| `GET` | `/api/profile/:userId/overview` | Profile page data (`?tzOffset=`). |
| `GET` | `/api/quiz-history/:source/:itemId` | Previous marks; `source` is `notes`, `youtube`, `doubt` or `plan`. |
| `POST` | `/api/usage/heartbeat` | Study time: `{day: "YYYY-MM-DD", seconds}`. `text/plain` bodies (from `sendBeacon`) may carry `token` instead of the header. Capped at 5 minutes per call and 24 hours per day. |

</details>

<details>
<summary><b>Novard Agent</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/agent/chat` | **AI.** `{message, conversationId?}` → Server-Sent Events: `meta`, `token`, `status`, `action`, `superseded`, `title`, `done`, `error`. |
| `POST` | `/api/agent/conversations/:id/actions/:actionId` | **AI.** `{decision: confirm\|dismiss}` → `{action}`. |
| `GET` | `/api/agent/conversations/user/:userId`, `/api/agent/conversations/:id` | List / open chats. |
| `PATCH` | `/api/agent/conversations/:id` | `{title}`. |
| `DELETE` | `/api/agent/conversations/:id` | Delete a chat. |

</details>

---

## Data Models

Twelve Mongoose schemas in [server/models/](server/models/), each indexed on the fields its list queries filter and sort by:

| Model | Holds |
| --- | --- |
| `User` | Name, unique email, picture, mobile, bio. |
| `Notes` | Uploaded PDF metadata, extracted text, summary, chat history and memory, quiz attempts. |
| `YouTubeVideo` | URL/`videoId`, transcript, summary, chat history and memory, quizzes (older records may be uploaded files). |
| `DoubtClearance` | Title, description, optional image link, chat history and memory, summary, quizzes, YouTube recommendations. |
| `SkillPlan` | Skill, duration, preferences, per-day plan with matched video and completion flags, quiz configuration and attempt history. |
| `ForumIssue` / `ForumComment` | Discussions with category, tags and status; threaded replies with an `isAI` flag. |
| `Video` | Video Library learning requests. |
| `Roadmap` | Generated career roadmaps (stages, topics, projects). |
| `SkillGapSession` | A skill-gap analysis and its coaching chat. |
| `ChatbotConversation` | Novard Agent chats, with action cards and their status. |
| `AppUsage` | Tracked study seconds per student per local day. |

---

## Project Structure

```
novard-ai/
├── client/                        # React SPA (Create React App)
│   ├── src/
│   │   ├── App.js                 # Route table + auth guards
│   │   ├── AuthContext.js         # Google sign-in → API session
│   │   ├── lib/api.js             # Axios/fetch client: base URL, timeout, session token, 401 handling
│   │   ├── lib/session.js         # Session storage (token + profile)
│   │   ├── pages/                 # Route-level pages
│   │   ├── components/            # Sidebar, hub views, analytics widgets, agent, forum
│   │   ├── hooks/                 # useStudyTimeTracker
│   │   └── **/__tests__/          # Jest + React Testing Library
│   ├── .env.example
│   ├── Dockerfile                 # Node build → Nginx serve
│   └── nginx.conf.template        # SPA fallback, $PORT-aware
│
├── server/                        # Express API
│   ├── server.js                  # Entry: env checks, DB connect, listen, graceful shutdown
│   ├── app.js                     # Express app: headers, CORS, limits, routes, error handler
│   ├── routes/                    # URL → middleware → controller
│   ├── controllers/               # HTTP in/out only
│   ├── services/                  # Business logic and data access
│   ├── agent/                     # Novard Agent: turn loop, actions, conversations
│   ├── ai/                        # Groq client, LangChain memory, Gemini, AI error handling
│   ├── middleware/                # auth, rate limits, async wrapper, error handler
│   ├── models/                    # Mongoose schemas
│   ├── config/                    # env, db, model IDs, shared prompts
│   ├── utils/                     # logger, HttpError, validators, uploads, JSON recovery
│   ├── scripts/                   # One-off maintenance scripts
│   ├── tests/                     # Jest unit + API tests (in-memory MongoDB)
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml             # Dev: mongo + server + client
├── docker-compose.prod.yml        # Prod image smoke test (external Atlas)
├── cloudbuild.yaml                # Cloud Build pipeline
├── deploy.sh                      # One-command Cloud Run deploy
├── CLOUD_RUN_SETUP.md             # Cloud Run guide
├── DOCKER_SETUP.md                # Docker guide
└── vercel.json                    # Client-only SPA deploy config
```

---

## Known Gaps

Worth knowing before you build on this:

- **Uploads are stored on local disk.** On Cloud Run the filesystem is ephemeral, so uploaded PDFs do not survive an instance restart. Move to Cloud Storage for a real deployment.
- **Sessions live in `localStorage`** and cannot be revoked individually before they expire (7 days by default); rotating `JWT_SECRET` signs everyone out.
- **Forum replies show each author's email address** to every signed-in student.
- **Rate limits are per instance** (in memory). With several Cloud Run instances, use a shared store (e.g. Redis) for exact limits.
- **The client is built with Create React App**, which is deprecated; most remaining `npm audit` findings are in its build tooling. Migrating to Vite would clear them.
- **YouTube captions are not always available** (and YouTube changes its private API regularly); without captions the summarizer falls back to title + description.
- **Scanned PDFs have no text layer**, so notes upload rejects them with a 422 rather than running OCR.

---

## Contributing

1. Fork the repository.
2. Create a feature branch — `git checkout -b feature/amazing-feature`.
3. Commit your changes — `git commit -m 'Add amazing feature'`.
4. Push the branch — `git push origin feature/amazing-feature`.
5. Open a pull request.

---

## License

MIT.

---

## Acknowledgments

**Groq** for low-latency inference · **Google AI** for Gemini · **MongoDB** · **YouTube** via `youtubei.js` and `youtube-search-api`.

---

<p align="center"><i>Transforming careers, one prompt at a time.</i></p>
