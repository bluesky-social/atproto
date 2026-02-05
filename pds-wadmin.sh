#!/bin/bash
#
# W Social PDS Admin Tool
# Unified admin script for W ID, Migration, and Invitation management
#
# Usage: ./pds-wadmin.sh <category> <command> [args...]
#
# Required environment variables:
#   PDS_HOST - The PDS hostname (e.g., https://pds-stage.wsocial.eu)
#   PDS_ADMIN_PASSWORD - Admin password for authentication
#

set -euo pipefail

# Check required environment variables
check_env() {
  if [ -z "${PDS_HOST:-}" ]; then
    echo "ERROR: PDS_HOST environment variable is not set"
    echo "Example: export PDS_HOST=https://pds-stage.wsocial.eu"
    exit 1
  fi

  if [ -z "${PDS_ADMIN_PASSWORD:-}" ]; then
    echo "ERROR: PDS_ADMIN_PASSWORD environment variable is not set"
    echo "Example: export PDS_ADMIN_PASSWORD=your-admin-password"
    exit 1
  fi
}

# Print usage information
usage() {
  cat <<EOF
W Social PDS Admin Tool

Unified admin interface for PDS management.

Usage: $0 <category> <command> [args...]

Categories:
  wid           W ID (Legal ID) management
  migration     Account migration between PDS
  invitation    Invitation management

WID Commands:
  wid list                           List all accounts with W ID links
  wid show <did>                     Show W ID details for account
  wid update <did> <legal-id>        Update W ID for account

Migration Commands:
  migration migrate <did> <target-pds-url> [handle]
                                     Migrate account to target PDS

Invitation Commands:
  invitation list [--status=STATUS] [--before=TIMESTAMP] [--json]
                                     List invitations
  invitation stats [--since=TIMESTAMP] [--json]
                                     Get invitation statistics
  invitation show <email|id>         Show specific invitation
  invitation revoke <email|id>       Revoke pending invitation
  invitation purge --status=STATUS [--before=TIMESTAMP]
                                     Purge invitations by status

Invitation Status Values:
  pending, consumed, expired, revoked, all

Environment Variables:
  PDS_HOST                  PDS hostname (e.g., https://pds-stage.wsocial.eu)
  PDS_ADMIN_PASSWORD        Admin password

Examples:
  # WID management
  export PDS_HOST=https://pds-stage.wsocial.eu
  export PDS_ADMIN_PASSWORD=your-password
  pds-wadmin.sh wid list
  pds-wadmin.sh wid show did:plc:abc123
  pds-wadmin.sh wid update did:plc:abc123 uuid@legal.lab.tagroot.io

  # Account migration
  pds-wadmin.sh migration migrate did:plc:abc123 https://pds2.wsocial.eu

  # Invitation management
  pds-wadmin.sh invitation list --status=pending
  pds-wadmin.sh invitation stats --since=2026-02-01T00:00:00Z
  pds-wadmin.sh invitation show user@example.com
  pds-wadmin.sh invitation revoke user@example.com
  pds-wadmin.sh invitation purge --status=consumed --before=2026-01-01T00:00:00Z

EOF
  exit 1
}

# Make API call to PDS
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  local url="${PDS_HOST}/xrpc/${endpoint}"

  if [ "$method" = "GET" ]; then
    curl -s --user "admin:${PDS_ADMIN_PASSWORD}" \
      "$url" 2>&1
  else
    curl -s --user "admin:${PDS_ADMIN_PASSWORD}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$url" 2>&1
  fi
}

#
# WID COMMANDS
#

cmd_wid_list() {
  local response
  response=$(api_call "GET" "com.atproto.admin.listNeuroAccounts?limit=1000")

  echo "$response" | jq -r '
    ["DID", "HANDLE", "EMAIL", "W_ID", "LINKED_AT"],
    (
      .accounts[] | [
        .did,
        .handle,
        (.email // "-"),
        (.neuroJid // "-"),
        (.linkedAt // "-")
      ]
    ) | @tsv
  ' | column -t -s $'\t'
}

cmd_wid_show() {
  local did="$1"

  if [ -z "$did" ]; then
    echo "ERROR: DID is required"
    echo "Usage: pds-wadmin.sh wid show <did>"
    exit 1
  fi

  local response
  response=$(api_call "GET" "com.atproto.admin.getNeuroLink?did=$did")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "ERROR: Failed to fetch account details"
    echo "$response" | jq -r '.message // .error'
    exit 1
  fi

  echo "$response" | jq '
    {
      "DID": .did,
      "Handle": .handle,
      "Email": (.email // "N/A"),
      "W ID (Legal ID)": (.neuroJid // "Not linked"),
      "Linked At": (.linkedAt // "N/A"),
      "Last Login": (.lastLoginAt // "N/A")
    }
  '
}

cmd_wid_update() {
  local did="$1"
  local new_legal_id="$2"

  if [ -z "$did" ] || [ -z "$new_legal_id" ]; then
    echo "ERROR: Both DID and new Legal ID are required"
    echo "Usage: pds-wadmin.sh wid update <did> <legal-id>"
    exit 1
  fi

  if [[ ! "$new_legal_id" =~ @legal\. ]]; then
    echo "ERROR: Invalid Legal ID format (must contain '@legal.')"
    exit 1
  fi

  local data
  data=$(jq -n \
    --arg did "$did" \
    --arg newLegalId "$new_legal_id" \
    '{did: $did, newLegalId: $newLegalId}')

  local response
  response=$(api_call "POST" "com.atproto.admin.updateNeuroLink" "$data")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "ERROR: Failed to update W ID"
    echo "$response" | jq -r '.message // .error'
    exit 1
  fi

  echo "✓ Success!"
  echo "$response" | jq '
    {
      "DID": .did,
      "Old W ID": (.oldLegalId // "None"),
      "New W ID": .newLegalId,
      "Updated At": .updatedAt
    }
  '
}

#
# MIGRATION COMMANDS
#

cmd_migration_migrate() {
  local did="$1"
  local target_pds="$2"
  local target_handle="${3:-}"

  if [ -z "$did" ] || [ -z "$target_pds" ]; then
    echo "ERROR: DID and target PDS URL are required"
    echo "Usage: pds-wadmin.sh migration migrate <did> <target-pds-url> [handle]"
    exit 1
  fi

  echo "Migrating account: $did"
  echo "Target PDS: $target_pds"
  [ -n "$target_handle" ] && echo "New handle: $target_handle"

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
    "Migrated At": .migratedAt
  }'
}

#
# INVITATION COMMANDS
#

cmd_invitation_list() {
  local status="pending"
  local before=""
  local json_output=false
  local limit=50
  local cursor=""

  # Parse flags
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --status=*)
        status="${1#*=}"
        shift
        ;;
      --before=*)
        before="${1#*=}"
        shift
        ;;
      --json)
        json_output=true
        shift
        ;;
      --limit=*)
        limit="${1#*=}"
        shift
        ;;
      *)
        echo "ERROR: Unknown option: $1"
        exit 1
        ;;
    esac
  done

  local url="io.trustanchor.admin.listInvitations?status=$status&limit=$limit"
  [ -n "$before" ] && url="$url&before=$before"
  [ -n "$cursor" ] && url="$url&cursor=$cursor"

  local response
  response=$(api_call "GET" "$url")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "ERROR: Failed to list invitations"
    echo "$response" | jq -r '.message // .error'
    exit 1
  fi

  if [ "$json_output" = true ]; then
    echo "$response"
  else
    echo "$response" | jq -r '
      ["ID", "EMAIL", "HANDLE", "STATUS", "CREATED", "CONSUMED", "CONSUMING_DID"],
      (
        .invitations[] | [
          .id,
          .email,
          (.preferredHandle // "-"),
          .status,
          .createdAt,
          (.consumedAt // "-"),
          (.consumingDid // "-")
        ]
      ) | @tsv
    ' | column -t -s $'\t'
  fi
}

cmd_invitation_stats() {
  local since=""
  local json_output=false

  # Parse flags
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --since=*)
        since="${1#*=}"
        shift
        ;;
      --json)
        json_output=true
        shift
        ;;
      *)
        echo "ERROR: Unknown option: $1"
        exit 1
        ;;
    esac
  done

  local url="io.trustanchor.admin.getInvitationStats"
  [ -n "$since" ] && url="$url?since=$since"

  local response
  response=$(api_call "GET" "$url")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "ERROR: Failed to get stats"
    echo "$response" | jq -r '.message // .error'
    exit 1
  fi

  if [ "$json_output" = true ]; then
    echo "$response"
  else
    echo "Invitation Statistics:"
    echo "===================="
    echo "$response" | jq -r '
      "Pending:      \(.pending)",
      "Consumed:     \(.consumed)",
      "Expired:      \(.expired)",
      "Revoked:      \(.revoked)",
      (if .consumedSince then "Consumed Since: \(.consumedSince)" else empty end),
      (if .conversionRate then "Conversion Rate: \((.conversionRate * 100 | floor))%" else empty end)
    '
  fi
}

cmd_invitation_show() {
  local identifier="$1"

  if [ -z "$identifier" ]; then
    echo "ERROR: Email or ID is required"
    echo "Usage: pds-wadmin.sh invitation show <email|id>"
    exit 1
  fi

  # Determine if identifier is numeric (ID) or email
  if [[ "$identifier" =~ ^[0-9]+$ ]]; then
    # It's an ID - fetch by list and filter
    local response
    response=$(api_call "GET" "io.trustanchor.admin.listInvitations?status=all&limit=1000")

    echo "$response" | jq --arg id "$identifier" '
      .invitations[] | select(.id == ($id | tonumber)) | {
        "ID": .id,
        "Email": .email,
        "Preferred Handle": (.preferredHandle // "N/A"),
        "Status": .status,
        "Created At": .createdAt,
        "Expires At": .expiresAt,
        "Consumed At": (.consumedAt // "N/A"),
        "Consuming DID": (.consumingDid // "N/A"),
        "Consuming Handle": (.consumingHandle // "N/A")
      }
    '
  else
    # It's an email - fetch and filter
    local response
    response=$(api_call "GET" "io.trustanchor.admin.listInvitations?status=all&limit=1000")

    echo "$response" | jq --arg email "$identifier" '
      .invitations[] | select(.email == $email) | {
        "ID": .id,
        "Email": .email,
        "Preferred Handle": (.preferredHandle // "N/A"),
        "Status": .status,
        "Created At": .createdAt,
        "Expires At": .expiresAt,
        "Consumed At": (.consumedAt // "N/A"),
        "Consuming DID": (.consumingDid // "N/A"),
        "Consuming Handle": (.consumingHandle // "N/A")
      }
    '
  fi
}

cmd_invitation_revoke() {
  local identifier="$1"

  if [ -z "$identifier" ]; then
    echo "ERROR: Email or ID is required"
    echo "Usage: pds-wadmin.sh invitation revoke <email|id>"
    exit 1
  fi

  local data
  if [[ "$identifier" =~ ^[0-9]+$ ]]; then
    data=$(jq -n --argjson id "$identifier" '{id: $id}')
  else
    data=$(jq -n --arg email "$identifier" '{email: $email}')
  fi

  local response
  response=$(api_call "POST" "io.trustanchor.admin.deleteInvitation" "$data")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "ERROR: Failed to revoke invitation"
    echo "$response" | jq -r '.message // .error'
    exit 1
  fi

  echo "✓ Success!"
  if echo "$response" | jq -e '.revoked' > /dev/null 2>&1; then
    echo "Invitation revoked (soft delete)"
  else
    echo "Invitation deleted (hard delete - was not pending)"
  fi
}

cmd_invitation_purge() {
  local status=""
  local before=""

  # Parse flags
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --status=*)
        status="${1#*=}"
        shift
        ;;
      --before=*)
        before="${1#*=}"
        shift
        ;;
      *)
        echo "ERROR: Unknown option: $1"
        exit 1
        ;;
    esac
  done

  if [ -z "$status" ]; then
    echo "ERROR: --status is required"
    echo "Usage: pds-wadmin.sh invitation purge --status=STATUS [--before=TIMESTAMP]"
    echo "Status must be: consumed, expired, or revoked"
    exit 1
  fi

  if [[ ! "$status" =~ ^(consumed|expired|revoked)$ ]]; then
    echo "ERROR: Invalid status. Must be: consumed, expired, or revoked"
    exit 1
  fi

  local data
  if [ -n "$before" ]; then
    data=$(jq -n \
      --arg status "$status" \
      --arg before "$before" \
      '{status: $status, before: $before}')
  else
    data=$(jq -n \
      --arg status "$status" \
      '{status: $status}')
  fi

  echo "Purging $status invitations..."
  [ -n "$before" ] && echo "Before: $before"

  local response
  response=$(api_call "POST" "io.trustanchor.admin.purgeInvitations" "$data")

  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    echo "ERROR: Failed to purge invitations"
    echo "$response" | jq -r '.message // .error'
    exit 1
  fi

  echo "✓ Success!"
  echo "$response" | jq -r '"Deleted \(.deletedCount) invitations"'
}

#
# MAIN
#

main() {
  if [ $# -eq 0 ]; then
    usage
  fi

  check_env

  local category="$1"
  shift

  case "$category" in
    wid)
      if [ $# -eq 0 ]; then
        echo "ERROR: WID command required"
        usage
      fi
      local cmd="$1"
      shift
      case "$cmd" in
        list)
          cmd_wid_list
          ;;
        show)
          cmd_wid_show "$@"
          ;;
        update)
          cmd_wid_update "$@"
          ;;
        *)
          echo "ERROR: Unknown wid command: $cmd"
          usage
          ;;
      esac
      ;;

    migration)
      if [ $# -eq 0 ]; then
        echo "ERROR: Migration command required"
        usage
      fi
      local cmd="$1"
      shift
      case "$cmd" in
        migrate)
          cmd_migration_migrate "$@"
          ;;
        *)
          echo "ERROR: Unknown migration command: $cmd"
          usage
          ;;
      esac
      ;;

    invitation)
      if [ $# -eq 0 ]; then
        echo "ERROR: Invitation command required"
        usage
      fi
      local cmd="$1"
      shift
      case "$cmd" in
        list)
          cmd_invitation_list "$@"
          ;;
        stats)
          cmd_invitation_stats "$@"
          ;;
        show)
          cmd_invitation_show "$@"
          ;;
        revoke)
          cmd_invitation_revoke "$@"
          ;;
        purge)
          cmd_invitation_purge "$@"
          ;;
        *)
          echo "ERROR: Unknown invitation command: $cmd"
          usage
          ;;
      esac
      ;;

    help|--help|-h)
      usage
      ;;

    *)
      echo "ERROR: Unknown category: $category"
      usage
      ;;
  esac
}

main "$@"
