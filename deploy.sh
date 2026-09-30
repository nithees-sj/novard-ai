#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# deploy.sh — Build & deploy Novard-AI to Google Cloud Run
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration (edit these or pass as env vars) ──
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-asia-south1}"
SERVER_IMAGE="novard-server"
CLIENT_IMAGE="novard-client"
SERVER_SERVICE="novard-server"
CLIENT_SERVICE="novard-client"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Pre-flight checks ──
command -v gcloud >/dev/null 2>&1 || err "gcloud CLI not found. Install it: https://cloud.google.com/sdk/docs/install"
command -v docker >/dev/null 2>&1 || err "Docker not found. Install it: https://docs.docker.com/get-docker/"

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
  if [[ -z "$PROJECT_ID" ]]; then
    err "No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID\n       Or set GCP_PROJECT_ID env var."
  fi
fi

info "Project:  $PROJECT_ID"
info "Region:   $REGION"
echo ""

# ── Step 1: Authenticate & configure ──
info "Ensuring gcloud is authenticated..."
gcloud auth print-access-token >/dev/null 2>&1 || gcloud auth login
gcloud config set project "$PROJECT_ID"

# ── Step 2: Enable required APIs ──
info "Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# ── Step 3: Create Artifact Registry repo (if not exists) ──
REPO_NAME="novard-ai"
AR_HOST="${REGION}-docker.pkg.dev"
AR_REPO="${AR_HOST}/${PROJECT_ID}/${REPO_NAME}"

info "Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe "$REPO_NAME" \
  --location="$REGION" \
  --project="$PROJECT_ID" >/dev/null 2>&1 || \
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --description="Novard-AI container images"

# ── Step 4: Configure Docker for Artifact Registry ──
info "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker "$AR_HOST" --quiet

# ── Step 5: Read env vars from server/.env ──
info "Reading environment variables from server/.env..."
ENV_FILE="./server/.env"
MONGO_URI=""
GROQ_API_KEY=""
GOOGLE_API_KEY=""
JWT_SECRET=""
# Optional (admin console and risk scoring)
SUPERADMIN_EMAILS=""
ADMIN_JWT_EXPIRES_IN=""
RISK_CRON_SECRET=""

if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    # Remove surrounding quotes
    value="${value%\"}"
    value="${value#\"}"
    case "$key" in
      MONGO_URI)       MONGO_URI="$value" ;;
      GROQ_API_KEY)    GROQ_API_KEY="$value" ;;
      GOOGLE_API_KEY)  GOOGLE_API_KEY="$value" ;;
      JWT_SECRET)      JWT_SECRET="$value" ;;
      SUPERADMIN_EMAILS)    SUPERADMIN_EMAILS="$value" ;;
      ADMIN_JWT_EXPIRES_IN) ADMIN_JWT_EXPIRES_IN="$value" ;;
      RISK_CRON_SECRET)     RISK_CRON_SECRET="$value" ;;
    esac
  done < "$ENV_FILE"
fi

[[ -z "$MONGO_URI" ]] && err "MONGO_URI not found in server/.env. Set it to your MongoDB Atlas connection string."
[[ "$MONGO_URI" == *"localhost"* ]] && warn "MONGO_URI points to localhost — this won't work on Cloud Run. Use MongoDB Atlas."
[[ -z "$JWT_SECRET" ]] && err "JWT_SECRET not found in server/.env. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""

# The server only accepts sign-ins issued to this OAuth client, and the client is built with it.
GOOGLE_CLIENT_ID="${REACT_APP_GOOGLE_CLIENT_ID:-}"
if [[ -z "$GOOGLE_CLIENT_ID" && -f "./client/.env" ]]; then
  GOOGLE_CLIENT_ID=$(grep REACT_APP_GOOGLE_CLIENT_ID ./client/.env | cut -d'=' -f2- || true)
fi
[[ -z "$GOOGLE_CLIENT_ID" ]] && err "REACT_APP_GOOGLE_CLIENT_ID not found. Set it in client/.env or the environment."

# ── Step 6: Build & push server image ──
info "Building server image..."
docker build -t "${AR_REPO}/${SERVER_IMAGE}:latest" ./server
info "Pushing server image..."
docker push "${AR_REPO}/${SERVER_IMAGE}:latest"
ok "Server image pushed"

# ── Step 7: Deploy server to Cloud Run ──
# "^##^" makes "##" the separator, because SUPERADMIN_EMAILS holds commas and MONGO_URI can hold "@".
SERVER_ENV="^##^NODE_ENV=production##MONGO_URI=${MONGO_URI}##GROQ_API_KEY=${GROQ_API_KEY}##GOOGLE_API_KEY=${GOOGLE_API_KEY}##JWT_SECRET=${JWT_SECRET}##GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
[[ -n "$SUPERADMIN_EMAILS" ]] && SERVER_ENV="${SERVER_ENV}##SUPERADMIN_EMAILS=${SUPERADMIN_EMAILS}"
[[ -n "$ADMIN_JWT_EXPIRES_IN" ]] && SERVER_ENV="${SERVER_ENV}##ADMIN_JWT_EXPIRES_IN=${ADMIN_JWT_EXPIRES_IN}"
[[ -n "$RISK_CRON_SECRET" ]] && SERVER_ENV="${SERVER_ENV}##RISK_CRON_SECRET=${RISK_CRON_SECRET}"
info "Deploying server to Cloud Run..."
gcloud run deploy "$SERVER_SERVICE" \
  --image="${AR_REPO}/${SERVER_IMAGE}:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="${SERVER_ENV}" \
  --quiet

# ── Step 8: Get server URL ──
SERVER_URL=$(gcloud run services describe "$SERVER_SERVICE" \
  --region="$REGION" \
  --format='value(status.url)')
ok "Server deployed at: $SERVER_URL"

# ── Step 8b (optional): score risk every hour with Cloud Scheduler ──
# Cloud Run scales to zero, so the app runs nothing on a timer itself.
if [[ -n "$RISK_CRON_SECRET" ]]; then
  info "Scheduling the hourly risk rescan (Cloud Scheduler)..."
  gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT_ID" --quiet
  SCHEDULER_ARGS=(--location="$REGION" --project="$PROJECT_ID" --schedule="15 * * * *" --http-method=POST
    --uri="${SERVER_URL}/api/internal/risk/rescan" --headers="X-Risk-Cron-Secret=${RISK_CRON_SECRET}" --attempt-deadline=300s --quiet)
  if gcloud scheduler jobs describe novard-risk-rescan --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud scheduler jobs update http novard-risk-rescan "${SCHEDULER_ARGS[@]}"
  else
    gcloud scheduler jobs create http novard-risk-rescan "${SCHEDULER_ARGS[@]}"
  fi
  ok "Risk rescan scheduled hourly"
else
  warn "RISK_CRON_SECRET not set: risk scores refresh when an admin opens the risk board (see CLOUD_RUN_SETUP.md)."
fi

# ── Step 9: Build & push client image (with server URL baked in) ──
info "Building client image (API → $SERVER_URL)..."
docker build \
  --build-arg REACT_APP_API_ENDPOINT="$SERVER_URL" \
  --build-arg REACT_APP_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  -t "${AR_REPO}/${CLIENT_IMAGE}:latest" \
  ./client
info "Pushing client image..."
docker push "${AR_REPO}/${CLIENT_IMAGE}:latest"
ok "Client image pushed"

# ── Step 10: Deploy client to Cloud Run ──
info "Deploying client to Cloud Run..."
gcloud run deploy "$CLIENT_SERVICE" \
  --image="${AR_REPO}/${CLIENT_IMAGE}:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --quiet

# ── Step 11: Get client URL ──
CLIENT_URL=$(gcloud run services describe "$CLIENT_SERVICE" \
  --region="$REGION" \
  --format='value(status.url)')
ok "Client deployed at: $CLIENT_URL"

# ── Step 12: Only the deployed client may call the API from a browser ──
info "Restricting API CORS to $CLIENT_URL..."
gcloud run services update "$SERVER_SERVICE" \
  --region="$REGION" \
  --update-env-vars="CORS_ORIGINS=${CLIENT_URL}" \
  --quiet

# ── Summary ──
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Novard-AI deployed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  $CLIENT_URL"
echo -e "  ${CYAN}Backend:${NC}   $SERVER_URL"
echo -e "  ${CYAN}Health:${NC}    ${SERVER_URL}/health"
echo ""
echo -e "${YELLOW}  Next steps:${NC}"
echo -e "  1. Add ${CLIENT_URL} to Google OAuth Authorized JavaScript Origins"
echo -e "  2. If you add a custom domain, add it to the server's CORS_ORIGINS"
echo -e "  3. Ensure MongoDB Atlas allows connections from all IPs (0.0.0.0/0)"
echo ""
