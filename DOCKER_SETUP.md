# Docker Setup for Novard-AI

This project runs as 3 containers:

- `mongo` — MongoDB with Atlas Search (`mongodb/mongodb-atlas-local`) on host port `27018`
- `server` — Node.js + Express API on port `5001`
- `client` — React app built and served via Nginx on port `3000`

## 1) Install Docker

Install Docker Desktop (or Docker Engine + Docker Compose plugin on Linux).

Verify installation:

```bash
docker --version
docker compose version
```

## 2) Configure Environment Variables

### Server (`server/.env`)

Create `server/.env` with:

```env
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_google_ai_api_key
# Signs session tokens (required in production):
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=your_long_random_secret
PORT=5001
NODE_ENV=production
```

`GOOGLE_CLIENT_ID` and `CORS_ORIGINS` are set by `docker-compose.yml` from `REACT_APP_GOOGLE_CLIENT_ID` (below). See `server/.env.example` for every option.

### Client (Google OAuth)

Set your Google OAuth Client ID as a shell environment variable before building:

```bash
export REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

Or create a `.env` file in the **project root** (not `client/`):

```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

Docker Compose reads this automatically and passes it as a build arg to the client container.

## Local MongoDB with vector search

The `mongo` service uses the `mongodb/mongodb-atlas-local` image: an ordinary
MongoDB 8 plus Atlas Search, so the early-warning feature's semantic search over
problem reports works locally the same way it does on MongoDB Atlas. Create the
vector index once (it is idempotent):

```bash
MONGO_URI="mongodb://localhost:27018/novard-ai?directConnection=true" npm run db:vector-index --prefix server
```

Connection strings to this container need `directConnection=true` (it runs as a
one-node replica set). Without the index, or on a MongoDB without Atlas Search,
the app falls back to MongoDB text search automatically.

### Moving your data from the old `mongo:7.0` container

The atlas-local image cannot start on the old `mongo:7.0` data volume (it
initialises its own security key on an empty volume), so it uses two new
volumes. The old volume (`novard-ai_mongodb_data`) is **kept, not deleted**.
To copy your data across once:

```bash
# 1. Before switching: dump from the old container (still running mongo:7.0)
docker exec novard-ai-mongo mongodump --archive --db novard-ai > novard-ai.archive

# 2. Start the new database
docker compose up -d mongo

# 3. Restore into it (wait until `docker compose ps` shows mongo as healthy)
docker exec -i novard-ai-mongo mongorestore --archive < novard-ai.archive
```

If you already switched, start a temporary `mongo:7.0` on the old volume to dump it:

```bash
docker run -d --name old-mongo -v novard-ai_mongodb_data:/data/db mongo:7.0
docker exec old-mongo mongodump --archive --db novard-ai | docker exec -i novard-ai-mongo mongorestore --archive
docker rm -f old-mongo
```

This path (dump from mongo 7.0, restore into atlas-local 8.3) was tested on a
copy of a real Novard database: every collection's count matched.

## 3) Build and Start

From the project root:

```bash
docker compose up --build
```

Open:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001

## 4) Useful Commands

Start in background:

```bash
docker compose up -d
```

View logs:

```bash
docker compose logs -f
```

Stop containers:

```bash
docker compose down
```

Stop and delete volumes/networks:

```bash
docker compose down -v
```

Rebuild after code/config changes:

```bash
docker compose up --build
```

## 5) Architecture

```
┌─────────────────────────────┐
│   Client Container          │
│   Nginx (port 80 → 3000)   │
│   Serves React build        │
│   SPA routing via nginx     │
└─────────┬───────────────────┘
          │ API calls to http://localhost:5001
┌─────────▼───────────────────┐
│   Server Container          │
│   Node.js (port 5001)       │
│   Express API + CORS        │
│   Connects to MongoDB       │
└─────────────────────────────┘
```

## 6) Common Issues

1. **Port already in use**
   - Stop local processes or change port mapping in `docker-compose.yml`.

2. **MongoDB connection fails**
   - Check `MONGO_URI` in `server/.env`.
   - For Docker: use a MongoDB Atlas connection string (not `localhost`).
   - Ensure your MongoDB Atlas network access allows your IP (or `0.0.0.0/0`).

3. **Frontend cannot call backend**
   - Ensure the server container is healthy before the client starts.
   - `REACT_APP_API_ENDPOINT` is set to `http://localhost:5001` in `docker-compose.yml`.

4. **Google OAuth not working**
   - Ensure `REACT_APP_GOOGLE_CLIENT_ID` is set before running `docker compose up --build`.
   - Add `http://localhost:3000` as an Authorized JavaScript Origin in Google Cloud Console.

5. **File uploads not visible after restart**
   - Uploads are persisted via host mapping: `./server/uploads:/app/uploads`.
