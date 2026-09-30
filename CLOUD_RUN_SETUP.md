# Cloud Run Deployment Guide — Novard-AI

Deploy the full Novard-AI application (server + client) to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK (`gcloud`)** installed and authenticated
3. **Docker** installed locally
4. **MongoDB Atlas** cluster with a connection string (Cloud Run cannot run persistent MongoDB)

### Install Google Cloud SDK

```bash
# Linux / macOS
curl -sSL https://sdk.cloud.google.com | bash
exec -l $SHELL   # Restart shell to pick up PATH changes
gcloud init       # Login + select project
```

Or see: https://cloud.google.com/sdk/docs/install

## Quick Deploy (One Command)

```bash
# Set your GCP project ID
export GCP_PROJECT_ID=your-project-id

# Set your region (default: asia-south1)
export GCP_REGION=asia-south1

# Ensure server/.env has your production values:
#   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/novard-ai
#   GROQ_API_KEY=your_key
#   GOOGLE_API_KEY=your_key
#   JWT_SECRET=a_long_random_secret   (node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
# and client/.env has REACT_APP_GOOGLE_CLIENT_ID (the server is given the same value).

# Deploy!
./deploy.sh
```

The script will:
1. Authenticate with GCP
2. Enable required APIs (Cloud Run, Artifact Registry, Cloud Build)
3. Create an Artifact Registry repository
4. Build & push both Docker images
5. Deploy the **server** to Cloud Run (gets its URL)
6. Build the **client** with the server URL baked in
7. Deploy the **client** to Cloud Run
8. Print both service URLs

## Manual Step-by-Step Deploy

### 1. Authenticate

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

### 3. Create Artifact Registry Repo

```bash
gcloud artifacts repositories create novard-ai \
  --repository-format=docker \
  --location=asia-south1 \
  --description="Novard-AI container images"

gcloud auth configure-docker asia-south1-docker.pkg.dev
```

### 4. Build & Deploy Server

```bash
# Build
docker build -t asia-south1-docker.pkg.dev/YOUR_PROJECT/novard-ai/novard-server:latest ./server

# Push
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT/novard-ai/novard-server:latest

# Deploy
gcloud run deploy novard-server \
  --image=asia-south1-docker.pkg.dev/YOUR_PROJECT/novard-ai/novard-server:latest \
  --region=asia-south1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --set-env-vars="NODE_ENV=production,MONGO_URI=your_atlas_uri,GROQ_API_KEY=your_key,GOOGLE_API_KEY=your_key,JWT_SECRET=your_long_random_secret,GOOGLE_CLIENT_ID=your_google_client_id"
```

### 5. Get Server URL

```bash
gcloud run services describe novard-server --region=asia-south1 --format='value(status.url)'
# Example: https://novard-server-abc123.asia-south1.run.app
```

### 6. Build & Deploy Client

```bash
# Build (replace SERVER_URL with the URL from step 5)
docker build \
  --build-arg REACT_APP_API_ENDPOINT=https://novard-server-abc123.asia-south1.run.app \
  --build-arg REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id \
  -t asia-south1-docker.pkg.dev/YOUR_PROJECT/novard-ai/novard-client:latest \
  ./client

# Push
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT/novard-ai/novard-client:latest

# Deploy
gcloud run deploy novard-client \
  --image=asia-south1-docker.pkg.dev/YOUR_PROJECT/novard-ai/novard-client:latest \
  --region=asia-south1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi
```

## Post-Deployment Configuration

### Google OAuth

Add your Cloud Run client URL to the **Authorized JavaScript Origins** in the [Google Cloud Console OAuth credentials page](https://console.cloud.google.com/apis/credentials):

```
https://novard-client-abc123.asia-south1.run.app
```

### MongoDB Atlas Network Access

Ensure your MongoDB Atlas cluster allows connections from **all IPs** (`0.0.0.0/0`), since Cloud Run uses dynamic IP addresses, or configure [Serverless VPC Access](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access) for a static IP.

### CORS (if needed)

The server uses `cors()` with no restrictions, so all origins are allowed by default. If you want to restrict it in production, update `server/server.js`:

```javascript
app.use(cors({
  origin: 'https://novard-client-abc123.asia-south1.run.app'
}));
```

## Admin console and early warning

**First admin.** Add `SUPERADMIN_EMAILS=you@gmail.com` to `server/.env` before running `./deploy.sh` (or set it on the service), then sign in once at `https://<client-url>/admin/login`. Alternatively run `npm run admin:grant --prefix server -- --email you@gmail.com --role superadmin` against the production `MONGO_URI` from your machine. Optional: `ADMIN_JWT_EXPIRES_IN` (default `12h`).

**Vector search.** Report similarity search uses Atlas Vector Search when the cluster supports it. Create the index once (idempotent) from your machine:

```bash
MONGO_URI="mongodb+srv://…" npm run db:vector-index --prefix server
```

Without it (or without `GOOGLE_API_KEY`), the app uses MongoDB text search instead.

### Risk scoring schedule (optional)

Cloud Run scales to zero, so the app never runs anything on a timer by itself. To score risk hourly, set a long random `RISK_CRON_SECRET` in `server/.env`; `./deploy.sh` then sets it on the service and creates (or updates) a Cloud Scheduler job `novard-risk-rescan`. By hand:

```bash
gcloud services enable cloudscheduler.googleapis.com
gcloud scheduler jobs create http novard-risk-rescan \
  --location="$GCP_REGION" --schedule="15 * * * *" --http-method=POST \
  --uri="$SERVER_URL/api/internal/risk/rescan" \
  --headers="X-Risk-Cron-Secret=$RISK_CRON_SECRET" --attempt-deadline=300s
```

The endpoint returns 404 unless `RISK_CRON_SECRET` is set, and 401 for a wrong secret. Without a schedule, scores are refreshed whenever an admin opens the risk board and they are over an hour old. Turning on **Features & limits → Risk → auto-investigate** makes the scheduled rescan investigate newly raised alerts (it spends AI tokens).

**Investigations and CPU.** An investigation keeps running after `POST …/assess` has returned. With Cloud Run's default CPU throttling, the instance only has CPU while a request is open, so keep the console's live view open until it finishes (the stream is an open request), or deploy the server with `--no-cpu-throttling` (billed per instance-second) for unattended runs. A run still "running" after 15 minutes is shown as interrupted.

---

## CI/CD with Cloud Build

For automated deployments on git push, use the included `cloudbuild.yaml`:

```bash
# Submit a build manually
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_SERVER_URL=https://novard-server-abc123.run.app

# Or set up a trigger for automatic deploys
# See: https://cloud.google.com/build/docs/automating-builds/create-manage-triggers
```

## Architecture on Cloud Run

```
┌──────────────────────────────────┐
│   Cloud Run: novard-client       │
│   Nginx → serves React SPA      │
│   Listens on PORT (8080)         │
│   https://novard-client-xxx.app  │
└──────────┬───────────────────────┘
           │ API calls to server URL
┌──────────▼───────────────────────┐
│   Cloud Run: novard-server       │
│   Node.js / Express API          │
│   Listens on PORT (8080)         │
│   https://novard-server-xxx.app  │
└──────────┬───────────────────────┘
           │
┌──────────▼───────────────────────┐
│   MongoDB Atlas (external)       │
│   mongodb+srv://...              │
└──────────────────────────────────┘
```

## Cost Optimization

Cloud Run charges only for requests. With `min-instances=0`:

- **Server**: ~$0 when idle, scales up on traffic
- **Client**: ~$0 when idle, serves static files

For a low-traffic app, expect **< $5/month**.

## Testing Production Images Locally

Use the production docker-compose:

```bash
export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/novard-ai"
export GROQ_API_KEY="your_key"
export GOOGLE_API_KEY="your_key"
export JWT_SECRET="$(openssl rand -hex 48)"
export REACT_APP_GOOGLE_CLIENT_ID="your_google_client_id"

docker compose -f docker-compose.prod.yml up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080

## Troubleshooting

### Container crashes on Cloud Run

Check logs:

```bash
gcloud run services logs read novard-server --region=asia-south1 --limit=50
gcloud run services logs read novard-client --region=asia-south1 --limit=50
```

### MongoDB connection timeout

- Ensure `MONGO_URI` uses `mongodb+srv://` (Atlas format)
- Allow `0.0.0.0/0` in Atlas Network Access
- Check if your Atlas cluster is in a nearby region

### CORS errors in browser

- Verify the server's `cors()` config allows the client URL
- Check browser dev tools for the exact error

### Client shows blank page

- Verify `REACT_APP_API_ENDPOINT` was set correctly during build
- Inspect the built HTML source to confirm the API URL is embedded

## After deploying the client

Allow only the deployed client to call the API from a browser (deploy.sh does this for you):

```bash
gcloud run services update novard-server --region=asia-south1 \
  --update-env-vars="CORS_ORIGINS=https://your-client-url.run.app"
```
