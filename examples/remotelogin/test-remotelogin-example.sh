#!/bin/bash

# RemoteLogin Authentication Test Example
#
# This script demonstrates authenticating with Neuro RemoteLogin
# by calling the createSession endpoint with a Legal ID.
#
# Configuration:
#   PDS_URL - Your PDS URL (default: http://localhost:2583)
#   NEURO_LEGAL_ID - Your Neuro Legal ID (format: GUID@legal.domain.com)
#   TEST_HANDLE - Your ATProto handle

set -e

# Configuration from environment or defaults
PDS_URL="${PDS_URL:-http://localhost:2583}"
NEURO_LEGAL_ID="${NEURO_LEGAL_ID}"
TEST_HANDLE="${TEST_HANDLE}"

# Validate required variables
if [ -z "$NEURO_LEGAL_ID" ]; then
    echo "❌ Error: NEURO_LEGAL_ID environment variable is required"
    echo "   Example: export NEURO_LEGAL_ID='12345678-1234-1234-1234-123456789abc@legal.example.com'"
    exit 1
fi

if [ -z "$TEST_HANDLE" ]; then
    echo "❌ Error: TEST_HANDLE environment variable is required"
    echo "   Example: export TEST_HANDLE='testuser.example.com'"
    exit 1
fi

echo "🔐 RemoteLogin Authentication Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PDS URL:   $PDS_URL"
echo "Handle:    $TEST_HANDLE"
echo "Legal ID:  ${NEURO_LEGAL_ID:0:20}..."
echo ""
echo "📱 A petition will be sent to your Neuro app."
echo "   Please approve it when it appears!"
echo ""
echo "⏳ Initiating authentication..."
echo ""

# Call createSession with Legal ID as password
curl -X POST "$PDS_URL/xrpc/com.atproto.server.createSession" \
  -H "Content-Type: application/json" \
  -d "{
    \"identifier\": \"$TEST_HANDLE\",
    \"password\": \"$NEURO_LEGAL_ID\"
  }" \
  2>/dev/null | python3 -m json.tool || {
    echo ""
    echo "❌ Authentication failed"
    echo "   Check that:"
    echo "   - Your PDS is running and accessible"
    echo "   - Your account is linked to the Legal ID"
    echo "   - You approved the petition in your Neuro app"
    exit 1
  }

echo ""
echo "✅ If you see accessJwt and refreshJwt above, authentication succeeded!"
echo ""
echo "Note: The petition will timeout after 5 minutes if not approved."
