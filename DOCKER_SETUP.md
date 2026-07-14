# Docker Setup for Beginners

This project runs as 2 containers:

- `server` (Node + Express) on port `5001`
- `client` (React app) on port `3000`

## 1) Install Docker

Install Docker Desktop (or Docker Engine + Docker Compose plugin on Linux).

Verify installation:

```bash
docker --version
docker compose version
```

## 2) Create Environment File

Create this file before starting containers:

- `server/.env`

Minimum required keys:

```env
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
YOUTUBE_API_KEY=your_youtube_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
```

For frontend Firebase keys, this setup uses values from `client/.env` if you already use one locally.

## 3) Build and Start Containers

From project root:

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:3000
- Backend: http://localhost:5001

## 4) Useful Docker Commands

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

Stop and delete volumes/networks created by compose:

```bash
docker compose down -v
```

Rebuild after code/config changes:

```bash
docker compose up --build
```

## 5) Common Beginner Issues

1. Port already in use
- If `3000` or `5001` is busy, stop local processes or change port mapping in `docker-compose.yml`.

2. MongoDB connection fails
- Check `MONGO_URI` in `server/.env`.
- Ensure your MongoDB Atlas network access allows your IP.

3. Frontend cannot call backend
- Ensure backend is running and mapped to `5001`.
- `REACT_APP_API_ENDPOINT` in `docker-compose.yml` must match reachable host URL.

4. File upload not visible after restart
- Uploads are persisted with host mapping: `./server/uploads:/app/uploads`.
