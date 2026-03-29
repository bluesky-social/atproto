#!/usr/bin/env bash
set -euo pipefail

# Trigger Temporal updateImages workflows for all active PDS regions.
#
# Required env vars:
#   PDS_REGIONS_DB_URL  — Postgres connection string (pds_regions_reader role)
#   TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_API_KEY — start workflows
#
# Usage: trigger-update-images.sh <pds-image> <short-sha>

PDS_IMAGE="${1:?Usage: trigger-update-images.sh <pds-image> <short-sha>}"
SHORT_SHA="${2:?Usage: trigger-update-images.sh <pds-image> <short-sha>}"

: "${PDS_REGIONS_DB_URL:?}"
: "${TEMPORAL_ADDRESS:?}"
: "${TEMPORAL_NAMESPACE:?}"
: "${TEMPORAL_API_KEY:?}"

# --- Query pds_regions for distinct active region/cluster pairs -------------

REGIONS=$(psql "${PDS_REGIONS_DB_URL}" -t -A -F'|' \
  -c "SELECT DISTINCT region, name_prefix FROM pds_regions WHERE active = true")

if [ -z "${REGIONS}" ]; then
  echo "::error::No active PDS regions found"
  exit 1
fi

COUNT=$(echo "${REGIONS}" | wc -l | tr -d ' ')
echo "Found ${COUNT} region/cluster pair(s)"

# --- Start one Temporal workflow per region/cluster -------------------------

echo "${REGIONS}" | while IFS='|' read -r REGION CLUSTER; do
  WORKFLOW_ID="update-images-${REGION}-${SHORT_SHA}-$(date +%s)"

  INPUT_JSON=$(jq -nc \
    --arg region "${REGION}" \
    --arg cluster "${CLUSTER}" \
    --arg image "${PDS_IMAGE}" \
    '{region: $region, clusterName: $cluster, pdsImage: $image}')
  ENCODED_DATA=$(echo -n "${INPUT_JSON}" | base64 -w0)

  curl -sf -X POST \
    "https://${TEMPORAL_ADDRESS}/api/v1/namespaces/${TEMPORAL_NAMESPACE}/workflows/${WORKFLOW_ID}" \
    -H "Authorization: Bearer ${TEMPORAL_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"workflowType\": { \"name\": \"updateImages\" },
      \"taskQueue\": { \"name\": \"pds-operations\" },
      \"input\": {
        \"payloads\": [{
          \"metadata\": { \"encoding\": \"anNvbi9wbGFpbg==\" },
          \"data\": \"${ENCODED_DATA}\"
        }]
      },
      \"workflowExecutionTimeout\": \"3600s\",
      \"requestId\": \"$(cat /proc/sys/kernel/random/uuid)\"
    }"

  echo "Temporal workflow started: ${WORKFLOW_ID} (region=${REGION}, cluster=${CLUSTER})"
done
