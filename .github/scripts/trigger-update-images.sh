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

echo "${REGIONS}" | while IFS='|' read -r REGION NAME_PREFIX; do
  CLUSTER="${NAME_PREFIX}-cluster"
  WORKFLOW_ID="update-images-${REGION}-${SHORT_SHA}-$(date +%s)"

  INPUT_JSON=$(jq -nc \
    --arg region "${REGION}" \
    --arg cluster "${CLUSTER}" \
    --arg image "${PDS_IMAGE}" \
    '{region: $region, clusterName: $cluster, pdsImage: $image}')

  temporal workflow start \
    --address "${TEMPORAL_ADDRESS}" \
    --namespace "${TEMPORAL_NAMESPACE}" \
    --api-key "${TEMPORAL_API_KEY}" \
    --tls \
    --task-queue pds-operations \
    --type updateImages \
    --input "${INPUT_JSON}" \
    --workflow-id "${WORKFLOW_ID}"

  echo "Temporal workflow started: ${WORKFLOW_ID} (region=${REGION}, cluster=${CLUSTER})"
done
