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
    esac
  done < "$ENV_FILE"
fi

[[ -z "$MONGO_URI" ]] && err "MONGO_URI not found in server/.env. Set it to your MongoDB Atlas connection string."
[[ "$MONGO_URI" == *"localhost"* ]] && warn "MONGO_URI points to localhost — this won't work on Cloud Run. Use MongoDB Atlas."

# ── Step 6: Build & push server image ──
info "Building server image..."
docker build -t "${AR_REPO}/${SERVER_IMAGE}:latest" ./server
info "Pushing server image..."
docker push "${AR_REPO}/${SERVER_IMAGE}:latest"
ok "Server image pushed"

# ── Step 7: Deploy server to Cloud Run ──
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
  --set-env-vars="NODE_ENV=production,MONGO_URI=${MONGO_URI},GROQ_API_KEY=${GROQ_API_KEY},GOOGLE_API_KEY=${GOOGLE_API_KEY}" \
  --quiet

# ── Step 8: Get server URL ──
SERVER_URL=$(gcloud run services describe "$SERVER_SERVICE" \
  --region="$REGION" \
  --format='value(status.url)')
ok "Server deployed at: $SERVER_URL"

# ── Step 9: Build & push client image (with server URL baked in) ──
# Read Google OAuth Client ID
GOOGLE_CLIENT_ID="${REACT_APP_GOOGLE_CLIENT_ID:-}"
if [[ -z "$GOOGLE_CLIENT_ID" && -f "./client/.env" ]]; then
  GOOGLE_CLIENT_ID=$(grep REACT_APP_GOOGLE_CLIENT_ID ./client/.env | cut -d'=' -f2- || true)
fi
if [[ -z "$GOOGLE_CLIENT_ID" ]]; then
  GOOGLE_CLIENT_ID="821666149814-1cvmcovci4sgsn8ndedhlfbcg73scg0c.apps.googleusercontent.com"
  warn "Using default Google Client ID. Set REACT_APP_GOOGLE_CLIENT_ID to override."
fi

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
echo -e "  2. Update CORS on server if needed"
echo -e "  3. Ensure MongoDB Atlas allows connections from all IPs (0.0.0.0/0)"
echo ""
