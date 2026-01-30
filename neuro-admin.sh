#!/bin/bash
#
# Neuro Admin Script - Manage W ID (Neuro Legal ID) links for W Social accounts
# Usage: ./neuro-admin.sh <command> [args...]
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
W Social Neuro Admin Tool

Manage W ID (Neuro Legal ID) links for W Social accounts.

Usage: $0 <command> [args...]

Commands:
  list                      List all accounts with their W ID links
  show <did>                Show W ID details for a specific account
  update-wid <did> <legal-id>  Update the W ID for an account

Environment Variables:
  PDS_HOST                  The PDS hostname (e.g., https://pds-stage.wsocial.eu)
  PDS_ADMIN_PASSWORD        Admin password for authentication

Examples:
  # List all accounts
  export PDS_HOST=https://pds-stage.wsocial.eu
  export PDS_ADMIN_PASSWORD=your-password
  $0 list

  # Show W ID for specific account
  $0 show did:plc:abc123

  # Update W ID after user reinstalled app
  $0 update-wid did:plc:abc123 310f6f42-7c37-fa41-8c23-d1566e2cef66@legal.lab.tagroot.io

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

# Format and display account list
format_account_list() {
  echo "$1" | jq -r '
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

# Command: list - List all accounts with W ID links
cmd_list() {
  echo "Fetching accounts..."
  local response
  if ! response=$(api_call "GET" "com.atproto.admin.listNeuroAccounts?limit=1000"); then
    echo "ERROR: Failed to fetch accounts"
    echo "$response"
    exit 1
  fi

  format_account_list "$response"
}

# Command: show - Show W ID details for a specific account
cmd_show() {
  local did="$1"

  if [ -z "$did" ]; then
    echo "ERROR: DID is required"
    echo "Usage: $0 show <did>"
    exit 1
  fi

  echo "Fetching account details for: $did"
  local response
  if ! response=$(api_call "GET" "com.atproto.admin.getNeuroLink?did=$did"); then
    echo "ERROR: Failed to fetch account details"
    echo "$response"
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

# Command: update-wid - Update W ID for an account
cmd_update_wid() {
  local did="$1"
  local new_legal_id="$2"

  if [ -z "$did" ] || [ -z "$new_legal_id" ]; then
    echo "ERROR: Both DID and new Legal ID are required"
    echo "Usage: $0 update-wid <did> <legal-id>"
    echo "Example: $0 update-wid did:plc:abc123 uuid@legal.lab.tagroot.io"
    exit 1
  fi

  # Validate Legal ID format
  if [[ ! "$new_legal_id" =~ @legal\. ]]; then
    echo "ERROR: Invalid Legal ID format"
    echo "Legal ID must be in format: uuid@legal.domain"
    echo "Example: 310f6f42-7c37-fa41-8c23-d1566e2cef66@legal.lab.tagroot.io"
    exit 1
  fi

  echo "Updating W ID for account: $did"
  echo "New Legal ID: $new_legal_id"

  local data
  data=$(jq -n \
    --arg did "$did" \
    --arg newLegalId "$new_legal_id" \
    '{did: $did, newLegalId: $newLegalId}')

  local response
  response=$(api_call "POST" "com.atproto.admin.updateNeuroLink" "$data")
  
  # Check if response contains an error
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

# Main script
main() {
  if [ $# -eq 0 ]; then
    usage
  fi

  check_env

  local command="$1"
  shift

  case "$command" in
    list)
      cmd_list
      ;;
    show)
      cmd_show "$@"
      ;;
    update-wid)
      cmd_update_wid "$@"
      ;;
    help|--help|-h)
      usage
      ;;
    *)
      echo "ERROR: Unknown command: $command"
      echo
      usage
      ;;
  esac
}

main "$@"
