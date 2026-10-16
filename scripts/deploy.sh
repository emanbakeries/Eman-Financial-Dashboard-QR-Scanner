#!/bin/bash
set -e

PROJECT_ID="gen-lang-client-0447436480"
REGION="europe-west2"
SERVICE_NAME="eman-qr"

echo "=========================================================="
echo " Deploying Eman QR to Google Cloud Run"
echo " Project ID: $PROJECT_ID"
echo " Region:     $REGION"
echo " Service:    $SERVICE_NAME"
echo "=========================================================="

# Ensure the correct project is selected
gcloud config set project "$PROJECT_ID"

# Enable Cloud Run and Cloud Build APIs if not already enabled
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --project "$PROJECT_ID"

# Build and deploy from source
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL="https://wurdvtqmrschdghczyql.supabase.co"

echo ""
echo "Deployment completed successfully under project: $PROJECT_ID"
