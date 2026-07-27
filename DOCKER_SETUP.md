# Docker Setup for Novard-AI

This project runs as 2 containers:

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
PORT=5001
NODE_ENV=production
```

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
