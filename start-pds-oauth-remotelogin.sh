#!/bin/bash
set -e

# Stop and remove old container if it exists
docker stop pds-remotelogin 2>/dev/null || true
docker rm pds-remotelogin 2>/dev/null || true

mkdir -p /tmp/pds-docker-data

echo "🚀 Starting PDS with OAuth + RemoteLogin support..."

docker run -d \
  --name pds-remotelogin \
  -p 2583:3000 \
  -v /tmp/pds-docker-data:/app/data \
  -e PDS_HOSTNAME=jarlix.ngrok.dev \
  -e PDS_JWT_SECRET=test-jwt-secret-change-in-production \
  -e PDS_ADMIN_PASSWORD=test-admin-password \
  -e PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=0000000000000000000000000000000000000000000000000000000000000001 \
  -e PDS_BLOBSTORE_DISK_LOCATION=/app/data/blobs \
  -e PDS_DATA_DIRECTORY=/app/data \
  -e PDS_BSKY_APP_VIEW_URL=https://api.bsky.app \
  -e PDS_BSKY_APP_VIEW_DID=did:web:api.bsky.app \
  -e PDS_NEURO_ENABLED=true \
  -e PDS_NEURO_DOMAIN=lab.tagroot.io \
  -e PDS_NEURO_API_TYPE=remotelogin \
  -e PDS_NEURO_RESPONSE_METHOD=Poll \
  -e PDS_NEURO_POLL_INTERVAL_MS=2000 \
  -e PDS_NEURO_CALLBACK_BASE_URL=https://jarlix.ngrok.dev \
  -e PDS_NEURO_STORAGE_BACKEND=database \
  -e PDS_NEURO_AUTH_METHOD=basic \
  -e PDS_NEURO_BASIC_USERNAME=JanLindblad \
  -e PDS_NEURO_BASIC_PASSWORD=ASPcfgwuV_avn8VYieVL0pf8U4H6cXhixsdW6q27n8k \
  -e PDS_NEURO_VERIFY_JWT=false \
  -e PDS_NEURO_PETITION_TIMEOUT=300 \
  -e PDS_SERVICE_DID=did:web:jarlix.ngrok.dev \
  -e PDS_OAUTH_ISSUER=https://jarlix.ngrok.dev \
  -e PDS_OAUTH_JWKS_PRIVATE_KEYS='[{"kty":"EC","crv":"P-256","x":"placeholder","y":"placeholder","d":"placeholder"}]' \
  -e LOG_ENABLED=true \
  pds-remotelogin:latest

echo ""
echo "✅ PDS started with OAuth + RemoteLogin enabled"
echo "📁 Data persisted at: /tmp/pds-docker-data"
echo "🌐 Public URL: https://jarlix.ngrok.dev"
echo ""
echo "Waiting for PDS to be ready..."
sleep 5

# Check if OAuth is advertised
echo ""
echo "Checking OAuth configuration..."
curl -s https://jarlix.ngrok.dev/xrpc/com.atproto.server.describeServer | python3 -m json.tool
