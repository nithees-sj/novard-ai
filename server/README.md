# Novard-AI — API server

Express 4 + MongoDB (Mongoose) API behind the Novard-AI web app. The full
documentation (features, security model, API reference, deployment) is in the
[main README](../README.md).

## Quick start

```bash
npm install
cp .env.example .env      # fill in MONGO_URI, GROQ_API_KEY, GOOGLE_CLIENT_ID, JWT_SECRET
npm run dev               # http://localhost:5000, restarts on changes
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Run the API. |
| `npm run dev` | Run with `node --watch`. |
| `npm test` | Unit and API tests (in-memory MongoDB, AI and YouTube mocked). |
| `npm run test:coverage` | Tests with a coverage report in `coverage/`. |
| `npm run lint` | ESLint. |
| `npm run retitle-doubts` | One-off: AI-written titles for older doubts (`-- --dry-run` to preview). |

## Layout

```
server.js       entry point: env checks, DB connection, listen, graceful shutdown
app.js          Express app: security headers, CORS, body limit, rate limit, routes, errors
routes/         URL -> auth / rate-limit middleware -> controller
controllers/    HTTP in/out only (read the request, call a service, shape the response)
services/       business logic and data access, one module per feature
agent/          the Novard Agent: turn loop, actions it can take, conversation storage
ai/             Groq client, LangChain conversation memory, Gemini, AI error handling
middleware/     requireAuth, rate limits, async wrapper, central error handler
models/         Mongoose schemas
config/         environment, database connection, model IDs, shared prompts
utils/          logger, HttpError, validators, uploads, JSON recovery from model output
tests/          Jest unit tests and Supertest API tests
```

Errors from any layer reach the client as `{ "error": "...", "code": "..." }`
with a matching HTTP status; throw `HttpError` (see `utils/httpError.js`) to
choose the status and message.
