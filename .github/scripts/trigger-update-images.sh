#!/usr/bin/env bash
set -euo pipefail

# Trigger Temporal updateImages workflows for all active PDS regions.
#
# Required env vars:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — query active pds_instances
#   TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_API_KEY — start workflows
#
# Usage: trigger-update-images.sh <pds-image> <short-sha>

PDS_IMAGE="${1:?Usage: trigger-update-images.sh <pds-image> <short-sha>}"
SHORT_SHA="${2:?Usage: trigger-update-images.sh <pds-image> <short-sha>}"

: "${SUPABASE_URL:?}"
: "${SUPABASE_SERVICE_ROLE_KEY:?}"
: "${TEMPORAL_ADDRESS:?}"
: "${TEMPORAL_NAMESPACE:?}"
: "${TEMPORAL_API_KEY:?}"

# --- Query Supabase for distinct active region/cluster pairs ----------------

REGIONS=$(curl -sf \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  "${SUPABASE_URL}/rest/v1/pds_instances?select=region,cluster_name&status=eq.active" \
  | jq -c 'unique')

COUNT=$(echo "${REGIONS}" | jq 'length')
if [ "${COUNT}" -eq 0 ]; then
  echo "::error::No active PDS instances found in Supabase"
  exit 1
fi
echo "Found ${COUNT} region/cluster pair(s): ${REGIONS}"

# --- Start one Temporal workflow per region/cluster -------------------------

echo "${REGIONS}" | jq -c '.[]' | while read -r ENTRY; do
  REGION=$(echo "${ENTRY}" | jq -r '.region')
  CLUSTER=$(echo "${ENTRY}" | jq -r '.cluster_name')
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
