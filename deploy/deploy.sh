#!/bin/bash
# One-shot deploy of the SAFC app to Cloud Run + HTTPS LB on project safc-prod.
# Usage: BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX bash deploy/deploy.sh
set -euo pipefail

export CLOUDSDK_CORE_ACCOUNT=di@thirdculture.world
unset CLOUDSDK_CORE_PROJECT GOOGLE_APPLICATION_CREDENTIALS 2>/dev/null || true

PROJECT=safc-prod
REGION=africa-south1          # Johannesburg
BUILD_REGION=global
REPO=safc
SERVICE=safc-web
DOMAIN=southafricafc.com
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}:$(date +%Y%m%d-%H%M%S)"

cd "$(dirname "$0")/.."

# Load Supabase publishable config from .env without printing it
set -a; source .env; set +a

echo "==> [1/8] Linking billing account"
gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT"

echo "==> [2/8] Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com compute.googleapis.com \
  --project "$PROJECT"

echo "==> [3/8] Creating Artifact Registry repo"
gcloud artifacts repositories create "$REPO" --repository-format=docker \
  --location="$REGION" --project "$PROJECT" 2>/dev/null || echo "    (repo exists)"

echo "==> [4/8] Building image with Cloud Build"
gcloud builds submit . --config deploy/cloudbuild.yaml --project "$PROJECT" \
  --region="$BUILD_REGION" \
  --substitutions=_IMAGE="$IMAGE",_VITE_SUPABASE_URL="$VITE_SUPABASE_URL",_VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY",_VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID"

echo "==> [5/8] Deploying to Cloud Run ($REGION)"
gcloud run deploy "$SERVICE" --image "$IMAGE" --project "$PROJECT" \
  --region "$REGION" --allow-unauthenticated --port 8080 \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 \
  --update-env-vars "SUPABASE_URL=${SUPABASE_URL},SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY},SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID:-$VITE_SUPABASE_PROJECT_ID}"

echo "==> [6/8] Reserving global IP"
gcloud compute addresses create safc-ip --global --project "$PROJECT" 2>/dev/null || echo "    (ip exists)"
IP=$(gcloud compute addresses describe safc-ip --global --project "$PROJECT" --format='value(address)')
echo "    LB IP: $IP"

echo "==> [7/8] Building HTTPS load balancer + managed cert"
gcloud compute network-endpoint-groups create safc-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service="$SERVICE" --project "$PROJECT" 2>/dev/null || echo "    (neg exists)"

gcloud compute backend-services create safc-backend --global \
  --load-balancing-scheme=EXTERNAL_MANAGED --project "$PROJECT" 2>/dev/null || echo "    (backend exists)"

gcloud compute backend-services add-backend safc-backend --global \
  --network-endpoint-group=safc-neg --network-endpoint-group-region="$REGION" \
  --project "$PROJECT" 2>/dev/null || echo "    (backend already attached)"

gcloud compute url-maps create safc-urlmap --default-service=safc-backend \
  --project "$PROJECT" 2>/dev/null || echo "    (urlmap exists)"

gcloud compute ssl-certificates create safc-cert \
  --domains="$DOMAIN,www.$DOMAIN" --global --project "$PROJECT" 2>/dev/null || echo "    (cert exists)"

gcloud compute target-https-proxies create safc-https-proxy \
  --url-map=safc-urlmap --ssl-certificates=safc-cert --project "$PROJECT" 2>/dev/null || echo "    (https proxy exists)"

gcloud compute forwarding-rules create safc-https-fr --global \
  --load-balancing-scheme=EXTERNAL_MANAGED --address=safc-ip \
  --target-https-proxy=safc-https-proxy --ports=443 --project "$PROJECT" 2>/dev/null || echo "    (https rule exists)"

# HTTP -> HTTPS redirect
cat > /tmp/safc-redirect.yaml <<EOF
kind: compute#urlMap
name: safc-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF
gcloud compute url-maps import safc-http-redirect --source=/tmp/safc-redirect.yaml \
  --global --project "$PROJECT" --quiet 2>/dev/null || echo "    (redirect map exists)"
gcloud compute target-http-proxies create safc-http-proxy \
  --url-map=safc-http-redirect --project "$PROJECT" 2>/dev/null || echo "    (http proxy exists)"
gcloud compute forwarding-rules create safc-http-fr --global \
  --load-balancing-scheme=EXTERNAL_MANAGED --address=safc-ip \
  --target-http-proxy=safc-http-proxy --ports=80 --project "$PROJECT" 2>/dev/null || echo "    (http rule exists)"

echo "==> [8/8] Done. Cloud Run URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.url)'
echo "LB_IP=$IP"
