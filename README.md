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
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
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

Sign-in is **Google OAuth 2.0** through `@react-oauth/google` (implicit flow). The access token is exchanged for the Google userinfo profile, the session is persisted in `localStorage`, and the user record (name, email, picture) is upserted server-side. Every application route in [App.js](client/src/App.js) is guarded — unauthenticated visitors are redirected to the landing page. Users can extend their profile with a mobile number and bio from the Profile page.

A separate, hard-coded **teacher login** (`/teacher-login`) unlocks the teacher dashboard for course authoring.

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

### Notes: chat with your PDFs (`/notes`)

Upload a PDF (10 MB cap, PDF-only filter). The text is extracted with `pdf-parse` v2 (current pdf.js), chunked to fit the model context, and stored. You can then:

- **Chat** with the document — questions are answered from the extracted text, with full chat history retained per note.
- **Summarize** it — long documents are summarized chunk-by-chunk and then consolidated.
- **Generate a quiz** from the content, submit answers, and store a scored result (correct / total / percentage).

### Video Sessions (`/video`)

Three sub-tools behind one page:

- **Video Library** — describe what you want to learn and pick a platform (YouTube, Udemy, Coursera, edureka). YouTube results come from live search; Udemy/Coursera/edureka listings are produced by **Gemini Flash** with heavy prompt constraints pushing it toward real, still-live course URLs.
- **Video Summarizer** (`/youtube-video-summarizer`) — paste a YouTube URL *or* upload a video file (100 MB cap). For YouTube links, the caption track is pulled via Innertube and used as the transcript; title and description are fetched from the video metadata. You then get chat-over-transcript, summarization and quiz generation with saved results. Uploaded files without captions fall back to LLM-generated transcript-style content derived from the filename.
- **Teacher Guidance** (`/teacher-guidance`) — the same chat/summary/quiz loop over educational videos tagged by platform.

### Doubts & Learning (`/doubts`)

- **Notes & Quiz** — entry point into the notes workflow above.
- **Doubt Clearance** (`/doubt-clearance`) — open a doubt with a title, description and optional image reference, then hold a threaded conversation with the assistant. Responses are formatted for readability (code blocks, structured explanations). Each doubt can be summarized, turned into a quiz (with a content-aware fallback generator when the model returns unparseable JSON), and enriched with **YouTube video recommendations** that include a per-video reason for the suggestion.

### AI Forum (`/forum`)

A Stack Overflow-style Q&A board:

- Every post has a **category** (General, Tutorial, Urgent, Ideation, Showcase) and a separate **status** (Active, Solved, Closed).
- **Category, status, search and sort all combine** on the server: Latest, Most upvoted, Most discussed, Oldest, Title A–Z. Results are paginated, and "Load more" fetches the next page.
- **Only the author can mark a discussion solved, close it, reopen it or delete it.** The server rejects the same request from anyone else with a 403, and deleting a discussion also removes its replies. Closed discussions don't accept new replies.
- **AI participation:** the assistant answers every new discussion and every reply in the background, so posting never waits on the model. Its answers are Markdown (headings, lists, code, tables) and appear nested under the comment they answer, rather than wherever they happen to land in time order.
- Up/down voting on posts and comments.

### Teacher dashboard & courses

Teachers create courses (title, description, cover image) and attach videos with a Drive link, description, content summary and thumbnail. Per video they can generate a quiz with gpt-oss-120b, and learners' submissions are stored on the video with score, correct count and timestamp — so a teacher can review results per course video.

### Dashboard analytics (`/home`)

[analyticsController.js](server/controllers/analyticsController.js) turns what the student has actually done into deterministic numbers. These come from quiz answers, skill-plan days completed, questions asked and material studied. The same data always gives the same result:

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
- **Tests**: every submitted quiz from Notes, YouTube, the video library, Doubts, skill plans and teacher courses. Includes a score trend, a score spread, accuracy by section and by chosen difficulty, and a filterable history table.
- **Learning path**: skill plans with day progress and the next topic, roadmaps with their stages, and skill-gap analyses with readiness and top gaps.
- **Subject mastery**: the proficiency radar and strengths and weaknesses.

The charts are small SVG components written for this app ([components/profile/charts.jsx](client/src/components/profile/charts.jsx)); no chart library is used.

### Everywhere else

- A floating **Novard Agent** button available across the app (see [Novard Agent](#novard-agent) below).
- Markdown rendering (`react-markdown` + GFM, with Mermaid diagrams) for all AI output.
- Tailwind layouts with a persistent sidebar.

---

## Architecture

```
┌──────────────────────┐        ┌───────────────────────────┐
│  React 18 SPA        │        │  Express API              │
│  CRA + Tailwind      │  HTTP  │  16 controllers           │
│  react-router v6     ├───────►│  89 routes                │
│  Google OAuth (impl.)│        │  Mongoose ODM             │
└──────────────────────┘        └─────────┬─────────────────┘
                                          │
              ┌───────────────────────────┼──────────────────────────┐
              ▼                           ▼                          ▼
      ┌───────────────┐          ┌─────────────────┐        ┌────────────────┐
      │ MongoDB Atlas │          │ Groq (gpt-oss)  │        │ YouTube        │
      │ 13 collections│          │ Gemini Flash    │        │ (Innertube +   │
      └───────────────┘          └─────────────────┘        │  search API)   │
                                                            └────────────────┘
```

**Model routing.** Every model ID lives in [server/config/ai.js](server/config/ai.js) — the previous IDs were hard-coded in ~30 places and all broke at once when Groq retired the Llama 3.x family.

| Role | Model | Used for |
| --- | --- | --- |
| `MODELS.REASONING` | `openai/gpt-oss-120b` | Curriculum generation, quiz authoring, doubt clearance, forum answers. |
| `MODELS.FAST` | `openai/gpt-oss-20b` | Notes chat, summarization, video Q&A. |
| `MODELS.GEMINI` | `gemini-flash-latest` | Third-party course discovery only. |

Each can be overridden with `GROQ_MODEL_REASONING`, `GROQ_MODEL_FAST` or `GEMINI_MODEL` without touching code. The gpt-oss models are *reasoning* models: they spend completion tokens on an internal `reasoning` field before emitting `content`, so every Groq call sends `reasoning_effort: "low"` to keep the token budget available for the answer.

There is **no server-side auth middleware**: the client passes the user's email or a `userId` with requests, and controllers scope queries by that value.

---

## Conversational AI (LangChain)

Every chat in the app runs on one LangChain conversation engine,
[server/ai/conversation.js](server/ai/conversation.js):

| Chat | Memory stored on |
| --- | --- |
| Novard Agent | `ChatbotConversation.messages` (with each message's action cards) |
| Notes | `Notes.chatHistory` |
| Video Summarizer | `YouTubeVideo.chatHistory` |
| Teacher Guidance / educational videos | `EducationalVideo.chatHistory` |
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
- **Action tools** (`propose_*`) never act directly. Each becomes a **card** in the chat showing what the agent filled in, with *Yes* and *No thanks* buttons. Pressing *Yes* runs it:

| Card | What *Yes* does | Opens |
|------|-----------------|-------|
| Save as a doubt | Creates a doubt in Doubt Clearance, already containing the agent's explanation | `/doubt-clearance?open=<id>` |
| Add a video | Adds the chosen YouTube video (from a real search) to Video Summarizer | `/youtube-video-summarizer?open=<id>` |
| Generate a career roadmap | Generates a Smart Roadmap for the role, marking skills the student already knows | `/roadmap?open=<id>` |
| Create a learning plan | Builds a day-by-day Skill Unlocker plan with a video per day | `/skill-unlocker?open=<id>` |
| Analyse your skill gap | Runs a Skill Gap analysis and opens the coaching chat | `/skills-required?open=<id>` |
| Start a forum discussion | Posts to the AI Forum (the forum AI replies as usual) | `/forum?open=<issueId>` |

- **Same code as the pages:** each action calls the same function the page uses (`createDoubt`, `addYouTubeVideo`, `createRoadmapFor`, `createSkillPlan`, `startSession`, `openIssue`), so an item the agent creates is identical to one made by hand. Cards go from *needs your OK* → *working* → *done* (with an Open button), or *failed* with *Try again*.
- **No duplicates:** a card is claimed atomically, so a double click never creates two items.
- **Memory:** the agent remembers the whole conversation through the same summary-buffer memory as every other chat, including which cards it offered and whether the student accepted or declined them. So "make that roadmap intermediate instead" or "what did you suggest earlier?" work.
- **Safeguards:**
  - the model's arguments are cleaned and bounded, and video ids must come from a real search, never invented;
  - at most 2 proposals per turn;
  - if a reply says "confirm below" without calling a tool, one extra call recovers the card or removes the sentence.

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

**Backend** — Node.js 20, Express 4, Mongoose 8, LangChain (`@langchain/core`, `@langchain/groq`), `groq-sdk`, `@google/generative-ai`, `youtubei.js`, `youtube-search-api`, `pdf-parse`, Multer, `body-parser` (50 MB JSON limit), CORS.

**Infrastructure** — MongoDB Atlas, Docker + Docker Compose, Nginx (client image), Google Cloud Run + Artifact Registry + Cloud Build, Vercel (client-only SPA deploy via [vercel.json](vercel.json)).

---

## Getting Started

### Prerequisites

- Node.js 20+
- A MongoDB instance (Atlas connection string, or local/Docker MongoDB)
- A [Groq API key](https://console.groq.com)
- A Google AI (Gemini) API key — needed only for Udemy/Coursera/edureka course discovery
- A Google OAuth 2.0 Client ID (Web application) with your dev origin whitelisted

### Install

```bash
git clone <your-fork-url> novard-ai
cd novard-ai

# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### Configure

Create `server/.env`:

```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/novard-ai
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_google_ai_api_key
PORT=5000
NODE_ENV=development
```

Create `client/.env`:

```env
REACT_APP_API_ENDPOINT=http://localhost:5000
REACT_APP_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

### Run

```bash
# Terminal 1 — API on :5000
cd server && npm start

# Terminal 2 — React dev server on :3000
cd client && npm start
```

Open <http://localhost:3000>. The API exposes `GET /health` for liveness checks.

---

## Environment Variables

### Server

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | yes | MongoDB connection string. |
| `GROQ_API_KEY` | yes | Powers every Groq-backed feature. Without it, most of the app fails. |
| `GEMINI_API_KEY` | optional | Gemini Flash, used only for Udemy/Coursera/edureka course discovery. `GOOGLE_API_KEY` is accepted as an alias. |
| `PORT` | no | Defaults to `5000`; container images default to `8080`. |
| `NODE_ENV` | no | Standard Node environment flag. |

> The server refuses to start if `MONGO_URI` or `GROQ_API_KEY` is missing, and warns (without failing) when no Google AI key is set.

### Client

Create React App inlines `REACT_APP_*` values **at build time**, not at runtime — a container must be rebuilt (or built with the right `--build-arg`) to change them.

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

Both services declare health checks, and `server/uploads` is bind-mounted so uploaded PDFs and videos survive container restarts.

To smoke-test the production images against an external Atlas cluster, use [docker-compose.prod.yml](docker-compose.prod.yml) — it drops the MongoDB container and reads credentials from your shell. Full details in [DOCKER_SETUP.md](DOCKER_SETUP.md).

---

## Deploying to Google Cloud Run

[deploy.sh](deploy.sh) automates the whole path: it authenticates, enables the Cloud Run / Artifact Registry / Cloud Build APIs, creates the registry repo, builds and pushes both images, deploys the server, reads back its URL, rebuilds the client with that URL baked in, and deploys the client.

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=asia-south1   # optional, this is the default
./deploy.sh
```

The client image is a two-stage build (Node build → Nginx) whose config template is expanded with the `PORT` Cloud Run injects. [cloudbuild.yaml](cloudbuild.yaml) covers CI-triggered builds. Step-by-step manual instructions and troubleshooting live in [CLOUD_RUN_SETUP.md](CLOUD_RUN_SETUP.md).

Remember to add your deployed client URL to the **Authorized JavaScript origins** of your Google OAuth client.

---

## API Reference

All routes are defined in [server.js](server/server.js) (89 registrations). Base URL is `REACT_APP_API_ENDPOINT`. Unmatched paths and upload/body errors return JSON, never an HTML stack trace.

<details>
<summary><b>Health & users</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. |
| `GET` | `/` | Returns a plain-text banner. |
| `POST` | `/saveUser` | Upsert a user after Google sign-in. |
| `GET` | `/getUser/:email` | Fetch a user by email. |
| `GET` | `/getUserProfile` | Fetch the extended profile. |
| `POST` | `/updateUserProfile` | Update name / mobile / bio. |

</details>

<details>
<summary><b>Notes</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/upload-notes` | Multipart PDF upload (field `pdf`, 10 MB max). |
| `GET` | `/notes/:userId` | List a user's notes. |
| `POST` | `/chat-with-notes` | Ask a question against the extracted text. |
| `POST` | `/summarize-notes` | Chunked summarization. |
| `POST` | `/generate-quiz` | Build a quiz from the note. |
| `POST` | `/save-quiz-results` | Persist a scored attempt. |
| `DELETE` | `/notes/:noteId` | Delete a note. |

</details>

<details>
<summary><b>Video library & summarizer</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/video-requests/:userId` | List saved video requests. |
| `POST` | `/video-requests` | Create a request. |
| `DELETE` | `/video-requests/:videoRequestId` | Delete a request. |
| `POST` | `/recommend-videos` | Platform-aware recommendations (YouTube search or Gemini). |
| `GET`/`POST`/`DELETE` | `/educational-video-requests…`, `/recommend-educational-videos` | Same handlers under the educational namespace. |
| `POST` | `/youtube-videos` | Register a YouTube URL; fetches metadata + captions. |
| `POST` | `/upload-video` | Multipart video upload (field `video`, 100 MB max). |
| `GET` | `/youtube-videos/:userId` | List a user's videos. |
| `POST` | `/youtube/search` | Search YouTube. |
| `POST` | `/chat-with-youtube-video` | Chat over the transcript. |
| `POST` | `/summarize-youtube-video` | Summarize the transcript. |
| `POST` | `/generate-youtube-quiz` | Build a quiz. |
| `POST` | `/save-youtube-quiz-results` | Persist a scored attempt. |
| `DELETE` | `/youtube-videos/:videoId` | Delete a video. |
| `POST`/`GET`/`DELETE` | `/educational-videos…` | Equivalent set for teacher-guidance videos, plus `/chat-with-…`, `/summarize-…`, `/generate-educational-quiz`, `/save-educational-quiz-results`. |

</details>

<details>
<summary><b>Doubt clearance</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/doubt-clearances/:userId` | List a user's doubts. |
| `POST` | `/doubt-clearances` | Open a new doubt. |
| `POST` | `/chat-with-doubt-clearance` | Continue the conversation. |
| `POST` | `/summarize-doubt-clearance` | Summarize the thread (cached after first run). |
| `POST` | `/generate-doubt-quiz` | Quiz from the conversation. |
| `POST` | `/save-doubt-quiz-results` | Persist a scored attempt. |
| `POST` | `/get-youtube-recommendations` | Suggested videos with a reason each. |
| `DELETE` | `/doubt-clearances/:doubtId` | Delete a doubt. |

</details>

<details>
<summary><b>Forum</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/forum/issues` | Create an issue. |
| `GET` | `/api/forum/issues` | List issues. |
| `GET` | `/api/forum/issues/:issueId` | Fetch one issue. |
| `GET` | `/api/forum/search` | Search issues. |
| `PUT` | `/api/forum/issues/:issueId/status` | Change status. |
| `POST` | `/api/forum/issues/:issueId/vote` | Vote on an issue. |
| `GET` | `/api/forum/issues/:issueId/comments` | List comments. |
| `POST` | `/api/forum/comments` | Add a comment or nested reply. |
| `POST` | `/api/forum/comments/:commentId/vote` | Vote on a comment. |
| `POST` | `/api/forum/comments/:commentId/ai-response` | AI reply to a specific comment. |
| `POST` | `/api/forum/ai-response` | AI answer from a raw prompt. |

</details>

<details>
<summary><b>Courses & course quizzes</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/courses` | List all courses. |
| `GET` | `/api/courses/:courseId` | Fetch a course. |
| `POST` | `/api/courses` | Create a course. |
| `PUT` | `/api/courses/:courseId` | Update a course. |
| `DELETE` | `/api/courses/:courseId` | Delete a course. |
| `POST` | `/api/courses/:courseId/videos` | Add a video. |
| `PUT` | `/api/courses/:courseId/videos/:videoId` | Update a video. |
| `DELETE` | `/api/courses/:courseId/videos/:videoId` | Remove a video. |
| `POST` | `…/videos/:videoId/generate-quiz` | Generate a quiz for a video. |
| `GET` | `…/videos/:videoId/quiz` | Fetch the quiz. |
| `POST` | `…/videos/:videoId/quiz/submit` | Submit answers. |
| `GET` | `…/videos/:videoId/quiz/results` | Fetch results. |

</details>

<details>
<summary><b>Skill Unlocker & analytics</b></summary>

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/skill-unlocker/generate-plan` | Generate an N-day plan with matched YouTube videos. |
| `GET` | `/api/skill-unlocker/plans/:userId` | List a user's plans. |
| `POST` | `/api/skill-unlocker/toggle-day-completion` | Mark a day done/undone. |
| `POST` | `/api/skill-unlocker/refresh-video` | Re-match the video for one day. |
| `POST` | `/api/skill-unlocker/generate-quiz` | Quiz scoped to completed days. |
| `POST` | `/api/skill-unlocker/save-quiz-result` | Persist an attempt. |
| `DELETE` | `/api/skill-unlocker/plans/:planId` | Delete a plan. |
| `GET` | `/api/analytics/:userId` | Dashboard analytics (`?tzOffset=` minutes). |
| `POST` | `/api/usage/heartbeat` | Study-time tracker: `{userId, day: "YYYY-MM-DD", seconds}` (text/plain or JSON). Capped at 5 minutes per call and 24 hours per day. |
| `GET` | `/api/profile/:userId/overview` | Profile page data: account, goal, tests, learning paths, activity (`?tzOffset=`). |

</details>

---

## Data Models

Thirteen Mongoose schemas in [server/models/](server/models/):

| Model | Holds |
| --- | --- |
| `User` | Name, unique email, picture, mobile, bio. |
| `Skills` | Legacy per-role skill lists from the old Skill Gap Analysis (no longer used by the UI). |
| `Notes` | Uploaded PDF metadata, extracted text, summary, chat history, quiz attempts. |
| `YouTubeVideo` | URL/`videoId` or uploaded-file metadata, transcript, summary, chat history, quizzes. |
| `EducationalVideo` | Same shape, plus a `platform` enum (youtube / udemy / coursera / edureka). |
| `DoubtClearance` | Title, description, optional image, chat history, summary, quizzes, YouTube recommendations with reasons. |
| `SkillPlan` | Skill, duration, preferences, per-day plan with matched video and completion flags, quiz configuration and attempt history. |
| `Course` | Title, description, cover image, embedded videos each with quiz and per-user quiz results. |
| `ForumIssue` / `ForumComment` | Issues with tags, status and votes; comments with nesting, votes, `isAI` and `isSolution`. |
| `Video` | Lightweight video-request records. |

---

## Project Structure

```
novard-ai/
├── client/                      # React SPA (Create React App)
│   ├── src/
│   │   ├── App.js               # Route table + auth guards
│   │   ├── AuthContext.js       # Google OAuth provider, localStorage session
│   │   ├── pages/               # 22 route-level pages
│   │   ├── components/          # Sidebar, inline views, analytics widgets, chatbot
│   │   │   ├── MarkdownView.jsx   # The one Markdown renderer (GFM + Mermaid)
│   │   │   └── MermaidDiagram.jsx # Lazy-loaded flowchart rendering
│   │   ├── hooks/               # useViewportWidth
│   │   ├── images/roadmaps/     # 12 career roadmap graphics
│   ├── Dockerfile               # Node build → Nginx serve
│   └── nginx.conf.template      # SPA fallback, $PORT-aware
│
├── server/                      # Express API
│   ├── server.js                # 89 routes + error handling
│   ├── connect.js               # Mongoose connection
│   ├── config/ai.js             # Model IDs (single source of truth)
│   ├── config/prompts.js        # Shared Markdown + Mermaid format rules
│   ├── utils/parseModelJson.js  # Tolerant JSON extraction from model output
│   ├── controllers/             # 16 controllers
│   ├── models/                  # 13 Mongoose schemas
│   ├── uploads/                 # PDF and video uploads (bind-mounted in Docker)
│   └── Dockerfile
│
├── docker-compose.yml           # Dev: mongo + server + client
├── docker-compose.prod.yml      # Prod image smoke test (external Atlas)
├── cloudbuild.yaml              # Cloud Build pipeline
├── deploy.sh                    # One-command Cloud Run deploy
├── CLOUD_RUN_SETUP.md           # Cloud Run guide
├── DOCKER_SETUP.md              # Docker guide
└── vercel.json                  # Client-only SPA deploy config
```

---

## Known Gaps

Worth knowing before you build on this:

- **No server-side authorization.** Controllers trust the `userId` / email supplied in the request body or path. Anyone who can reach the API can read or delete another user's data. Add token verification middleware before exposing this publicly.
- **Forum ownership uses the client-supplied email**, like the rest of the app. It stops ordinary users from resolving or deleting other people's discussions, but a hand-crafted request could still impersonate someone until real server-side auth exists. Votes are also not limited to one per user.
- **Teacher credentials are hard-coded** in [TeacherLogin.jsx](client/src/pages/TeacherLogin.jsx) and checked client-side only.
- **Uploads are stored on local disk.** On Cloud Run the filesystem is ephemeral, so uploaded PDFs and videos do not survive an instance restart. Move to Cloud Storage for a real deployment.
- **CORS is fully open** (`app.use(cors())`).
- **No automated tests.** Testing libraries are installed on the client but no suites exist.
- **YouTube captions are often unavailable**, in which case the summarizer falls back to title + description, so summaries are shallower than the transcript-backed ones.
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
