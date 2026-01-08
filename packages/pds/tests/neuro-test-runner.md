# Neuro Quick Login Test Runner

This document explains how to run the Neuro Quick Login integration tests in different modes.

## Quick Start

### Run with Mock Neuro API (Default)

```bash
cd packages/pds
pnpm test neuro-integration
```

This runs the full test suite with a mock Neuro API server. All Neuro API calls are intercepted and simulated locally.

### Run with Real Neuro API

```bash
# When you receive Neuro API credentials
export NEURO_REAL_API=true
export NEURO_DOMAIN=mateo.lab.tagroot.io

cd packages/pds
pnpm test neuro-integration
```

**Note:** Tests using real API will pause and wait for you to scan QR codes with your Neuro app.

## Test Coverage

The integration tests cover:

### ✅ Core Functionality
- Session initiation and QR code generation
- Verification code generation (6-digit format)
- Callback handling from Neuro API
- Session completion tracking

### ✅ Authentication Flows
- **Sign-up**: Create new account with Neuro identity
- **Login**: Authenticate existing user with Neuro identity
- Account linking (Neuro JID ↔ DID)
- Last login timestamp updates

### ✅ API Endpoints
- `/neuro/callback` - Handles identity callbacks from Neuro
- `/neuro/session/:sessionId/status` - Session status polling
- Validation of required fields
- JID format validation

### ✅ Error Handling
- Missing required fields
- Invalid JID format
- Session expiration
- Duplicate callbacks (idempotency)
- Retry logic for API failures

### ✅ Database Operations
- Session storage and retrieval
- Identity linking
- Expired session cleanup
- Transaction handling

## Mock Neuro API

The mock server simulates the Neuro Quick Login API:

### Endpoints

**POST /QuickLogin**
- Accepts: `{ callbackUrl, sessionId }`
- Returns: `{ serviceId }`
- Creates a mock session

**POST /mock/scan-qr/:sessionId** (Test helper)
- Simulates scanning a QR code
- Triggers callback to PDS
- Accepts custom identity data:
  ```json
  {
    "jid": "user@neuro.example.com",
    "userName": "username",
    "email": "user@example.com"
  }
  ```

### Mock Server Lifecycle

The mock server:
1. Starts automatically before tests
2. Runs on a random available port
3. Stores session state in memory
4. Shuts down after tests complete

## Test Modes Comparison

| Feature | Mock Mode | Real API Mode |
|---------|-----------|---------------|
| Speed | ⚡ Fast | 🐌 Slow (manual QR scan) |
| Setup | ✅ Zero config | ⚙️ Requires credentials |
| QR Scanning | 🤖 Automated | 📱 Manual with app |
| Network | 🏠 Localhost only | 🌐 External API |
| Use Case | Development/CI | Pre-production validation |

## Running Individual Test Suites

```bash
# Run only NeuroAuthManager tests
pnpm test neuro-integration -t "NeuroAuthManager"

# Run only sign-up flow
pnpm test neuro-integration -t "Sign-up Flow"

# Run only login flow
pnpm test neuro-integration -t "Login Flow"

# Run only callback endpoint tests
pnpm test neuro-integration -t "Callback Endpoint"
```

## Debugging

### Enable verbose logging

```bash
# See all Neuro API calls
LOG_LEVEL=debug pnpm test neuro-integration

# See test network details
DEBUG=* pnpm test neuro-integration
```

### Inspect mock server

The mock server logs all requests:
```
🧪 Mock Neuro API running at http://localhost:54321
🧪 Mock Neuro: Session initiated { sessionId: 'abc123', serviceId: 'mock-service-123' }
🧪 Mock Neuro: QR scanned, sending callback { sessionId: 'abc123' }
🧪 Mock Neuro: Callback sent { status: 200, ok: true }
```

### Common Issues

**Test timeout in real API mode:**
- Default timeout is 70 seconds for QR scan
- Increase with: `jest.setTimeout(120000)` in test file

**Callback fails with ECONNREFUSED:**
- Ensure PDS test server is running
- Check `pdsUrl` is correct
- Verify mock server started successfully

**Session not found:**
- Check session expiration (default 5 minutes)
- Verify callback was sent to correct URL
- Enable debug logging to trace session lifecycle

## CI/CD Integration

For automated testing (GitHub Actions, etc.):

```yaml
- name: Run Neuro Integration Tests
  run: |
    cd packages/pds
    pnpm test neuro-integration
  env:
    # Always use mock mode in CI
    NEURO_REAL_API: false
```

## Manual Testing Flow

To manually test the full OAuth flow:

1. **Start PDS with Neuro enabled:**
   ```bash
   export PDS_NEURO_ENABLED=true
   export PDS_NEURO_DOMAIN=localhost:54321  # Mock server
   pnpm start
   ```

2. **In another terminal, run mock server:**
   ```bash
   # (Mock server starts automatically with tests, or create standalone)
   ```

3. **Initiate OAuth flow:**
   ```bash
   curl http://localhost:2583/oauth/authorize?...
   ```

4. **Scan QR code** (or trigger mock scan)

5. **Complete OAuth flow**

## Next Steps

Once real Neuro API credentials are available:

1. **Update environment variables:**
   ```bash
   export NEURO_REAL_API=true
   export NEURO_DOMAIN=mateo.lab.tagroot.io
   ```

2. **Run tests with real API:**
   ```bash
   pnpm test neuro-integration
   ```

3. **Verify QR codes scan correctly** with Neuro mobile app

4. **Test complete OAuth flows** with real client applications

## Test Maintenance

When updating Neuro integration:

- ✅ Add tests for new error codes
- ✅ Update mock server to match API changes
- ✅ Verify backward compatibility
- ✅ Document breaking changes
- ✅ Test migration paths
