#!/usr/bin/env bash
set -euo pipefail

# Trigger a single Temporal updateImages workflow with an image tag.
# The workflow handles multi-region orchestration internally.
#
# Required env vars:
#   TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_API_KEY
#
# Usage: trigger-update-images.sh <image-tag>

IMAGE_TAG="${1:?Usage: trigger-update-images.sh <image-tag>}"

: "${TEMPORAL_ADDRESS:?}"
: "${TEMPORAL_NAMESPACE:?}"
: "${TEMPORAL_API_KEY:?}"

WORKFLOW_ID="update-images-${IMAGE_TAG}-$(date +%s)"

temporal workflow start \
  --address "${TEMPORAL_ADDRESS}" \
  --namespace "${TEMPORAL_NAMESPACE}" \
  --api-key "${TEMPORAL_API_KEY}" \
  --tls \
  --task-queue pds-operations \
  --type updateImages \
  --workflow-id "${WORKFLOW_ID}" \
  --input "{\"imageTag\":\"${IMAGE_TAG}\"}"

echo "Workflow started: ${WORKFLOW_ID}"
