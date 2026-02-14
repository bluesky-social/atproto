#!/bin/bash
#
# PDS Account Migration Script
# Migrate accounts between W Social PDS servers
#

set -euo pipefail

usage() {
  cat <<EOF
PDS Account Migration Tool

Migrate accounts between W Social PDS servers with full data preservation.

Usage: $0 <command> [args...]

Commands:
  migrate <did> <target-pds-url>     Migrate account to target PDS
  status <did>                        Check migration status
  rollback <did>                      Reactivate account on source PDS

Environment Variables:
  PDS_HOST                  Source PDS URL
  PDS_ADMIN_PASSWORD        Admin password

Examples:
  # Migrate account to new PDS
  export PDS_HOST=https://pds1.wsocial.eu
  export PDS_ADMIN_PASSWORD=admin-pass
  $0 migrate did:plc:abc123 https://pds2.wsocial.eu

  # Migrate with new handle
  $0 migrate did:plc:abc123 https://pds2.wsocial.eu user.pds2.wsocial.eu

EOF
  exit 1
}

check_env() {
  if [ -z "${PDS_HOST:-}" ]; then
    echo "ERROR: PDS_HOST not set"
    exit 1
  fi
  if [ -z "${PDS_ADMIN_PASSWORD:-}" ]; then
    echo "ERROR: PDS_ADMIN_PASSWORD not set"
    exit 1
  fi
}

api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  if [ "$method" = "GET" ]; then
    curl -s --user "admin:${PDS_ADMIN_PASSWORD}" \
      "${PDS_HOST}/xrpc/${endpoint}"
  else
    curl -s --user "admin:${PDS_ADMIN_PASSWORD}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "${PDS_HOST}/xrpc/${endpoint}"
  fi
}

cmd_migrate() {
  local did="$1"
  local target_pds="$2"
  local target_handle="${3:-}"

  echo "Migrating account: $did"
  echo "Target PDS: $target_pds"
  [ -n "$target_handle" ] && echo "New handle: $target_handle"
  echo ""

  local data
  if [ -n "$target_handle" ]; then
    data=$(jq -n \
      --arg did "$did" \
      --arg targetPdsUrl "$target_pds" \
      --arg targetHandle "$target_handle" \
      '{did: $did, targetPdsUrl: $targetPdsUrl, targetHandle: $targetHandle}')
  else
    data=$(jq -n \
      --arg did "$did" \
      --arg targetPdsUrl "$target_pds" \
      '{did: $did, targetPdsUrl: $targetPdsUrl}')
  fi

  echo "Starting migration..."
  local response
  response=$(api_call "POST" "com.atproto.admin.migrateAccount" "$data")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "ERROR: Migration failed"
    echo "$response" | jq -r '.message // .error'
    exit 1
  fi

  echo "✓ Migration completed!"
  echo "$response" | jq '{
    DID: .did,
    "Source PDS": .sourcePds,
    "Target PDS": .targetPds,
    Status: .status,
    "Migrated At": .migratedAt,
    "Repo Blocks": .details.repoBlocks,
    "Blobs Transferred": .details.blobsTransferred,
    "W ID Migrated": .details.neuroLinkMigrated
  }'
}

main() {
  if [ $# -lt 1 ]; then
    usage
  fi

  check_env

  case "$1" in
    migrate)
      shift
      cmd_migrate "$@"
      ;;
    *)
      echo "ERROR: Unknown command: $1"
      usage
      ;;
  esac
}

main "$@"
