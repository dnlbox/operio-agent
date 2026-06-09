#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Deployment Script for Operio Agent
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

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"operio-agent-260608-3d6b"}
ZONE="us-central1-a"
VM_NAME="operio-live-agent"
MACHINE_TYPE="e2-standard-2" # 2 vCPUs, 8GB RAM (safe for Elasticsearch + Python + Node)

echo "==> 1. Configuring gcloud project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

echo "==> 2. Ensuring required GCP Services are enabled..."
gcloud services enable compute.googleapis.com aiplatform.googleapis.com

echo "==> 3. Creating or identifying IAM Service Account for the VM..."
SA_NAME="operio-vm-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null; then
  gcloud iam service-accounts create "$SA_NAME" \
    --description="Service account for Operio SRE agent VM" \
    --display-name="Operio VM Service Account"
fi

echo "==> 4. Binding Vertex AI User role to Service Account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user"

echo "==> 5. Creating firewall rules for HTTP and Arize Phoenix UI..."
if ! gcloud compute firewall-rules describe allow-operio-ports &>/dev/null; then
  gcloud compute firewall-rules create allow-operio-ports \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:80,tcp:443,tcp:6006 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=operio-server
fi

echo "==> 6. Provisioning GCE VM instance running Ubuntu 22.04 LTS..."
if ! gcloud compute instances describe "$VM_NAME" --zone="$ZONE" &>/dev/null; then
  gcloud compute instances create "$VM_NAME" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family="ubuntu-2204-lts" \
    --image-project="ubuntu-os-cloud" \
    --boot-disk-size="30GB" \
    --service-account="$SA_EMAIL" \
    --scopes="cloud-platform" \
    --tags=operio-server
else
  echo "VM $VM_NAME already exists, reusing it."
fi

# Retrieve VM public IP
VM_IP=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "==> VM Public IP is: $VM_IP"

echo "==> Waiting for SSH to be ready..."
until gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="echo SSH-ready" &>/dev/null; do
  echo "SSH not ready yet, retrying in 5 seconds..."
  sleep 5
done

echo "==> 7. Preparing and uploading deployment files..."
# Create a local .env.prod file for production environment configuration
cat <<EOF > .env.prod
GOOGLE_CLOUD_PROJECT=${PROJECT_ID}
GOOGLE_CLOUD_LOCATION=us-central1
ARIZE_API_KEY=${ARIZE_API_KEY:-}
ARIZE_SPACE_ID=${ARIZE_SPACE_ID:-}
EOF

# Upload config and compose files to VM
gcloud compute scp docker-compose.prod.yaml Caddyfile .env.prod "$VM_NAME":~/ --zone="$ZONE"
gcloud compute scp Dockerfile package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json "$VM_NAME":~/ --zone="$ZONE"

# Copy directories by tarring them first for efficiency
tar -czf app_src.tar.gz mcp_servers agents frontend scripts docs
gcloud compute scp app_src.tar.gz "$VM_NAME":~/ --zone="$ZONE"
rm app_src.tar.gz
rm .env.prod

echo "==> 8. Rebuilding and starting the application stack on the VM..."
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="
  # Update and install Docker and Docker Compose
  echo 'Installing Docker and Docker Compose on the VM...'
  sudo apt-get update && sudo apt-get install -y docker.io docker-compose
  
  # Extract source code
  tar -xzf app_src.tar.gz
  mv .env.prod .env
  
  # Run docker-compose with sudo
  echo 'Starting Docker Compose build and deployment...'
  sudo docker-compose -f docker-compose.prod.yaml down --remove-orphans || true
  sudo docker-compose -f docker-compose.prod.yaml up -d --build
  
  # Wait for services to stand up
  echo 'Waiting for Elasticsearch (port 9200) to accept connections...'
  until curl -s http://127.0.0.1:9200 >/dev/null; do
    echo 'Elasticsearch is not ready yet, retrying in 3 seconds...'
    sleep 3
  done
  echo 'Elasticsearch is up. Waiting an additional 5 seconds for cluster initialization...'
  sleep 5
  
  # Run the seed command inside the app container to load data
  echo 'Seeding databases with mock tenants, manuals, and leases...'
  sudo docker exec operio-app pnpm run seed
"

echo "=============================================================================="
echo "Deployment Successful!"
echo "------------------------------------------------------------------------------"
echo "  - Hosted Application: http://$VM_IP"
echo "  - Arize Phoenix UI:   http://$VM_IP:6006"
echo "=============================================================================="
