# Mock Neuro RemoteLogin Server

A local mock server for testing Neuro RemoteLogin integration with AT Protocol PDS.

## Quick Start

```bash
# Install dependencies
npm install

# Start server (auto-approves petitions after 2 seconds)
npm start

# Or use Node's watch mode for development
npm run dev
```

The server will start on `http://localhost:8080`

## How It Works

1. **PDS calls** `POST /RemoteLogin` with petition request
2. **Mock server** immediately returns `{PetitionId: "..."}`
3. **After 2 seconds**, mock server automatically POSTs callback to PDS with JWT token
4. **PDS receives** callback with `{PetitionId, Rejected: false, Token: "..."}`

## Configuration

Set environment variables to customize behavior:

```bash
# Port (default: 8080)
PORT=8080 npm start

# Callback delay in milliseconds (default: 2000)
CALLBACK_DELAY_MS=5000 npm start

# Disable auto-approve (manual mode)
AUTO_APPROVE=false npm start

# Mock user identifiers
MOCK_LEGAL_ID="custom-guid@legal.lab.tagroot.io" npm start
MOCK_JID="testuser@lab.tagroot.io" npm start
```

## Endpoints

### `POST /RemoteLogin`

Create a new petition (mimics Neuro RemoteLogin API).

**Request:**

```json
{
  "AddressType": "LegalId",
  "Address": "test-guid@legal.lab.tagroot.io",
  "ResponseMethod": "Callback",
  "CallbackURL": "http://localhost:3000/neuro/callback",
  "Seconds": 300,
  "Purpose": "Login to @alice.test"
}
```

**Response:**

```json
{
  "PetitionId": "mock-petition-abc123..."
}
```

### `POST /mock/approve/:petitionId`

Manually approve a petition (useful when `AUTO_APPROVE=false`).

**Example:**

```bash
curl -X POST http://localhost:8080/mock/approve/mock-petition-abc123
```

### `POST /mock/reject/:petitionId`

Manually reject a petition.

**Example:**

```bash
curl -X POST http://localhost:8080/mock/reject/mock-petition-abc123
```

### `GET /mock/petitions`

List all active petitions (debugging).

**Response:**

```json
{
  "count": 2,
  "petitions": [
    {
      "petitionId": "mock-petition-abc123",
      "addressType": "LegalId",
      "address": "test-guid@legal.lab.tagroot.io",
      "callbackUrl": "http://localhost:3000/neuro/callback",
      "purpose": "Login to @alice.test",
      "createdAt": 1735689600000
    }
  ]
}
```

### `GET /health`

Health check endpoint.

## Testing with PDS

### 1. Start Mock Server

```bash
cd mock-neuro-server
npm install
npm start
```

### 2. Configure PDS

Set these environment variables for your PDS:

```bash
export NEURO_ENABLED=true
export NEURO_DOMAIN=localhost:8080
export NEURO_STORAGE_BACKEND=database
export PDS_PUBLIC_URL=http://localhost:3000
```

### 3. Start PDS

```bash
cd packages/pds
pnpm start
```

### 4. Watch the Logs

**Terminal 1 (Mock Server):**

```
🔐 POST /RemoteLogin
Request body: {
  "AddressType": "LegalId",
  "Address": "test-guid@legal.lab.tagroot.io",
  ...
}
✅ Petition created: mock-petition-abc123
⏱️  Scheduling automatic approval in 2000ms...

📞 Sending callback to: http://localhost:3000/neuro/callback
   Petition ID: mock-petition-abc123
   Approved: true
   ✅ Token generated (eyJhbGci...)
   ✅ Callback sent successfully (200)
```

**Terminal 2 (PDS):**

```
Neuro callback received: mock-petition-abc123
JWT parsed: {
  jti: "...",
  iss: "lab.tagroot.io",
  sub: "test-guid@legal.lab.tagroot.io",
  ...
}
Account created: did:plc:...
```

## JWT Token Format

The mock server generates realistic JWT tokens with all expected claims:

```json
{
  "jti": "unique-token-id",
  "iss": "lab.tagroot.io",
  "sub": "test-guid@legal.lab.tagroot.io",
  "aud": "localhost:3000",
  "iat": 1735689600,
  "exp": 1735689900,
  "client_id": "test-guid@legal.lab.tagroot.io"
}
```

Signed with HMAC-SHA256 using a random secret (regenerated on each server start).

## Testing Scenarios

### Happy Path (Auto-approve)

```bash
# Server auto-approves after 2 seconds
npm start

# Trigger login in PDS
# Watch callback happen automatically
```

### Manual Approval

```bash
# Disable auto-approve
AUTO_APPROVE=false npm start

# Trigger login in PDS
# Server creates petition but doesn't callback

# Manually approve
curl -X POST http://localhost:8080/mock/approve/mock-petition-abc123
```

### Rejection Testing

```bash
# Disable auto-approve
AUTO_APPROVE=false npm start

# Trigger login in PDS
# Manually reject
curl -X POST http://localhost:8080/mock/reject/mock-petition-abc123

# PDS should handle rejection gracefully
```

### Different Users

```bash
# Use different Legal ID
MOCK_LEGAL_ID="user123@legal.lab.tagroot.io" npm start

# Or test with JID address type
# Change petition request to use AddressType: "JID"
```

## Debugging Tips

1. **Check petition list**

   ```bash
   curl http://localhost:8080/mock/petitions
   ```

2. **Verify callback URL is reachable**

   - Make sure PDS is running on the callback URL
   - Check firewall/network settings

3. **Inspect JWT tokens**

   - Copy token from logs
   - Decode at https://jwt.io
   - Verify claims match expectations

4. **Test callback manually**
   ```bash
   curl -X POST http://localhost:3000/neuro/callback \
     -H "Content-Type: application/json" \
     -d '{
       "PetitionId": "test-123",
       "Rejected": false,
       "Token": "eyJ..."
     }'
   ```

## Limitations

This is a **mock server for testing only**:

- ❌ No actual user authentication
- ❌ No security checks
- ❌ No petition expiration
- ❌ No rate limiting
- ❌ Tokens signed with random key (not Neuro's real key)

**Do not use in production!**

## Next Steps

Once your PDS integration works with the mock server:

1. Test against real Neuro staging environment
2. Obtain production credentials
3. Update to use real Neuro domain
4. Implement proper JWT signature verification with Neuro's public key
