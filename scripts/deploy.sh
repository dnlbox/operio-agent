#!/usr/bin/env bash
# ==============================================================================
# Cloud Run Manual Deploy Script (one-off local use)
# ==============================================================================
# Loads .env from the repo root, then deploys via Cloud Build + Cloud Run.
# The .env file may override any of the variables below.
# Requires: gcloud CLI authenticated with an account that has permission to
#           deploy Cloud Run services in PROJECT_ID.
# ==============================================================================
set -euo pipefail

# Load local environment settings if present
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
      export "$line"
    fi
  done < .env
fi

if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
  # Try to read it from gcloud configuration
  GOOGLE_CLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
fi

if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT environment variable is not set and could not be detected from gcloud config." >&2
  exit 1
fi

PROJECT_ID="${GOOGLE_CLOUD_PROJECT}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-operio-agent}"
SA_EMAIL="${SA_EMAIL:-operio-vm-sa@${PROJECT_ID}.iam.gserviceaccount.com}"

CPU_BOOST_FLAG=""
if [ "${CPU_BOOST:-false}" = "true" ] || [ "${CPU_BOOST:-}" = "--cpu-boost" ]; then
  CPU_BOOST_FLAG="--cpu-boost"
fi

echo "==> Deploying ${SERVICE} to Cloud Run in project ${PROJECT_ID} (${REGION})..."

gcloud run deploy "${SERVICE}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --port 3001 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances "${MIN_INSTANCES:-0}" \
  --max-instances "${MAX_INSTANCES:-3}" \
  ${CPU_BOOST_FLAG} \
  --allow-unauthenticated \
  --service-account "${SA_EMAIL}" \
  --set-secrets "MONGO_URI=operio-mongo-uri:latest,ARIZE_API_KEY=operio-arize-key:latest" \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},MONGO_DB=operio,OPERIO_REASONING_BACKEND=adk,ARIZE_SPACE_ID=${ARIZE_SPACE_ID:-U3BhY2U6NDU5NDk6TXpmMw==}"

SERVICE_URL=$(gcloud run services describe "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format "value(status.url)")

echo "=============================================================================="
echo "Deployment successful!"
echo "  Service URL: ${SERVICE_URL}"
echo "=============================================================================="
