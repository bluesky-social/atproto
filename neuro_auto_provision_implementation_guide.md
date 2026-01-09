# Neuro Auto-Provision Implementation Guide

## Overview

This guide describes how to implement the Neuro callback endpoint that automatically provisions Bluesky accounts when users create Neuro accounts.

**Flow:**
1. User creates account in Neuro app
2. Neuro immediately calls PDS callback endpoint with user info
3. PDS auto-creates Bluesky account and links to Legal ID
4. User can immediately login to Bluesky using Neuro RemoteLogin

**Note on Legal ID Stability:**
Legal IDs can change (typically every 2 years during renewal), but we'll receive callbacks when this happens. Neuro APIs continue to serve old Legal ID during a grace period. For our purposes, we treat Legal ID as the stable identifier for linking.

**Benefits:**
- Seamless onboarding (no manual Bluesky signup)
- User owns both Neuro and Bluesky accounts from day one
- Fewer steps, less friction

---

## Endpoint Specification

**URL:** `POST /neuro/provision/account`

**Authentication (Phase 1):** None (naked for initial experiments)

**Authentication (Phase 2):** mTLS (mutual TLS certificate validation)

**Content-Type:** `application/json`

**Rate Limiting:** TBD (recommend: 10 requests/minute per Neuro instance)

---

## Request Payload

### Actual Neuro Event Sequence

When a user creates a Neuro account, you'll receive multiple events. **Only process `LegalIdRegistered`** as it contains complete data:

**Event 1 - AccountCreated** (18:45:46):
```json
{
  "Timestamp": 1767807946,
  "EventId": "AccountCreated",
  "Object": "Jan3",
  "Tags": {
    "ApiKey": "56a9149812d978436e7ff65e60f17ada91938dc3a39b170a6f45786fe104cbff",
    "ObjectId": "30f1584a-51c7-9d56-1810-15d5f92d367d",
    "EMail": "",        // ❌ Empty - incomplete data
    "PhoneNr": ""       // ❌ Empty - incomplete data
  }
}
// Action: Ignore (return 202 Accepted)
```

**Event 2 - LegalIdRegistered** (18:45:47):
```json
{
  "Timestamp": 1767807947,
  "EventId": "LegalIdRegistered",
  "Object": "30f1584b-51c7-9d65-1810-15d5f9e42b4a@legal.lab.tagroot.io",
  "Actor": "Jan3@lab.tagroot.io",
  "Message": "Legal Identity application registered.",
  "Tags": {
    "ID": "30f1584b-51c7-9d65-1810-15d5f9e42b4a@legal.lab.tagroot.io",
    "Account": "Jan3",
    "JID": "Jan3@lab.tagroot.io",
    "EMAIL": "jan.lindblad@gmail.com",
    "PHONE": "+46702855728",
    "State": "Created",   // Not yet approved - don't process
    "Created": 1767807947,
    "From": 1767744000,
    "To": 1830816000,
    "COUNTRY": "SE"
  }
}
// Action: Log and ignore (return 200 OK) - not approved yet
```

**Events 3-5 - LegalIdUpdated** (18:45:48, multiple) ✅ **Process State='Approved'**:
```json
{
  "Timestamp": 1767807948,
  "EventId": "LegalIdUpdated",
  "Object": "30f1584b-51c7-9d65-1810-15d5f9e42b4a@legal.lab.tagroot.io",
  "Actor": "Jan3@lab.tagroot.io",
  "Tags": {
    "ID": "30f1584b-51c7-9d65-1810-15d5f9e42b4a@legal.lab.tagroot.io",
    "Account": "Jan3",
    "JID": "Jan3@lab.tagroot.io",
    "EMAIL": "jan.lindblad@gmail.com",
    "PHONE": "+46702855728",
    "State": "Approved",   // ✅ Now approved - provision account
    "COUNTRY": "SE"
  }
}
// Action: Provision account using Legal ID as identifier
```

### Field Mapping

**Extract from `LegalIdUpdated` payload (when `State='Approved'`):**

- **legalId** (stable identifier): `payload.Tags.ID`
  - Example: `"30f1584b-51c7-9d65-1810-15d5f9e42b4a@legal.lab.tagroot.io"`
  - **Use this for neuro_identity_link table**
  - Can change during renewal (~2 years), but we'll receive callbacks
  - Old Legal ID served during grace period

- **state**: `payload.Tags.State`
  - **Must be `"Approved"`** to provision account
  - Other states should be logged and ignored
  - **Complete list of states:**
    - `"Created"` - Legal ID registered but not yet approved (ignore)
    - `"Rejected"` - Legal ID application rejected (ignore, log for audit)
    - `"Approved"` - Legal ID approved ✅ **Process this state**
    - `"Obsoleted"` - Legal ID replaced by newer one (ignore, handled via new Approved event)
    - `"Compromised"` - Legal ID security compromised (ignore, log security alert)

- **userName**: `payload.Tags.Account`
  - Example: `"Jan3"`

- **email**: `payload.Tags.EMAIL || "noreply@wsocial.eu"`
  - Note: Uppercase `EMAIL` in Tags
  - Use noreply fallback if empty

- **phone**: `payload.Tags.PHONE`
  - Note: Uppercase `PHONE` in Tags

- **timestamp**: Convert Unix epoch: `new Date(payload.Timestamp * 1000)`

- **nonce**: Composite hash of event fields (see below)
  - ApiKey is NOT unique per event
  - Timestamp has 1s resolution (multiple events per second)
  - Solution: Hash of `EventId:Timestamp:Object:Actor`

- **jid** (optional, for reference): `payload.Tags.JID`
  - Format: `username@domain.tld`
  - Available but not used as primary identifier

### Validation Rules

1. **EventId and State**: Process `LegalIdUpdated` with `State="Approved"`
   - Log and return 200 for `AccountCreated` (not relevant)
   - Log and return 200 for `LegalIdRegistered` (not approved yet)
   - Log and return 200 for `LegalIdUpdated` with other states (rejected, pending, etc.)
   - **Note:** Event sequence may vary based on user's prior state

2. **Tags.ID**: Legal ID must be present and non-empty
   - Format: `uuid@legal.domain.tld`

3. **Tags.Account**: Username must be present

4. **Timestamp**: Must be within 10 minutes of current time (allows for network delays)

5. **Nonce**: Composite hash must not have been used before
   - Hash of `EventId:Timestamp:Object:Actor`
   - Prevents replay attacks while handling multiple events per second

---

## Implementation Steps

### Step 1: Create Endpoint File

**File:** `packages/pds/src/api/neuro/provisionAccount.ts`

```typescript
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import { AppContext } from '../../context'
import crypto from 'crypto'

export default function (server: Server, ctx: AppContext) {
  server.route({
    method: 'POST',
    path: '/neuro/provision/account',
    handler: async (req, res) => {
      const payload = req.body
      const eventId = payload.EventId

      // Step 1: Filter events - only process LegalIdUpdated with State=Approved
      const state = payload.Tags?.State

      if (eventId === 'AccountCreated') {
        req.log.debug({ account: payload.Object }, 'AccountCreated event - not relevant')
        return res.status(200).json({
          message: 'AccountCreated acknowledged'
        })
      }

      if (eventId === 'LegalIdRegistered') {
        req.log.debug({ legalId: payload.Object, state }, 'LegalIdRegistered event - not approved yet')
        return res.status(200).json({
          message: 'LegalIdRegistered acknowledged, waiting for approval'
        })
      }

      if (eventId === 'LegalIdUpdated' && state !== 'Approved') {
        req.log.info({ legalId: payload.Object, state }, 'LegalIdUpdated with non-Approved state - ignoring')
        return res.status(200).json({
          message: `Legal ID state is ${state}, not Approved`
        })
      }

      if (eventId !== 'LegalIdUpdated') {
        req.log.debug({ eventId }, 'Ignoring unknown event type')
        return res.status(200).json({
          message: `Event ${eventId} not relevant for provisioning`
        })
      }

      // At this point: eventId === 'LegalIdUpdated' && state === 'Approved'
      req.log.info({ legalId: payload.Object }, 'Processing approved Legal ID')

      // Step 2: Extract and validate required fields from LegalIdUpdated (Approved)
      const legalId = payload.Tags?.ID
      const userName = payload.Tags?.Account
      const timestamp = payload.Timestamp
      const emailFromNeuro = payload.Tags?.EMAIL?.trim()
      const phone = payload.Tags?.PHONE?.trim()
      const jidRef = payload.Tags?.JID  // For reference only
      // eventId and state already extracted in Step 1
      const object = payload.Object
      const actor = payload.Actor || ''

      if (!legalId || !userName || !timestamp) {
        return res.status(400).json({
          error: 'InvalidRequest',
          message: 'Missing required fields: Tags.ID, Tags.Account, Timestamp'
        })
      }

      // Step 3: Validate Legal ID format (uuid@legal.domain)
      if (!legalId.includes('@legal.')) {
        return res.status(400).json({
          error: 'InvalidLegalId',
          message: 'Tags.ID must be in format uuid@legal.domain'
        })
      }

      // Step 4: Convert timestamp and validate (within 10 minutes)
      const requestTime = timestamp * 1000 // Convert Unix epoch to ms
      const now = Date.now()
      const tenMinutes = 10 * 60 * 1000 // Increased for network delays
      if (Math.abs(now - requestTime) > tenMinutes) {
        return res.status(400).json({
          error: 'RequestExpired',
          message: 'Timestamp is too old or too far in the future'
        })
      }

      // Step 5: Generate composite nonce from event fields
      // ApiKey is NOT unique per event, timestamp has 1s resolution
      // Solution: Hash of event-identifying fields
      const nonceInput = `${eventId}:${timestamp}:${object}:${actor}`
      const nonce = crypto.createHash('sha256').update(nonceInput).digest('hex')

      // Step 6: Handle email (use Neuro's email or fallback to noreply)
      const email = emailFromNeuro || 'noreply@wsocial.eu'

      req.log.info({
        legalId,
        userName,
        email,
        emailFromNeuro: !!emailFromNeuro,
        phone,
        jidRef,
        country: payload.Tags?.COUNTRY,
        nonce,
      }, 'Received LegalIdUpdated (Approved) - provisioning account')

      // Step 7: Check for nonce reuse (replay protection)
      const nonceExists = await ctx.accountManager.db.db
        .selectFrom('neuro_provision_nonce')
        .select(['nonce'])
        .where('nonce', '=', nonce)
        .executeTakeFirst()

      if (nonceExists) {
        req.log.warn({ nonce, legalId }, 'Nonce reused - duplicate event')
        return res.status(400).json({
          error: 'NonceReused',
          message: 'This event has already been processed'
        })
      }

      // Step 8: Check if Legal ID already linked (before any provisioning)
      const existingLink = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['did', 'neuroJid'])
        .where('neuroJid', '=', legalId)
        .executeTakeFirst()

      if (existingLink) {
        req.log.info({ legalId, did: existingLink.did }, 'Account already provisioned for this Legal ID')

        // Idempotent: return existing account info
        const account = await ctx.accountManager.getAccount(existingLink.did)
        return res.status(200).json({
          success: true,
          alreadyExists: true,
          did: existingLink.did,
          handle: account?.handle || null,
          legalId
        })
      }

      // Step 9: Validate email not already taken (skip for noreply address)
      if (email !== 'noreply@wsocial.eu') {
        const emailAcct = await ctx.accountManager.getAccount(email)
        if (emailAcct) {
          return res.status(409).json({
            error: 'EmailTaken',
            message: 'This email is already associated with another account'
          })
        }
      }

      // Step 11: Generate handle (try suggested, append random digits if taken)
      // Format: john → john_3 → john_39 → john_391 (keep appending until available)
      let handle = `${userName}.${ctx.cfg.service.hostname}`
      let handleAcct = await ctx.accountManager.getAccount(handle)
      let suffix = ''

      while (handleAcct) {
        // Handle taken, append random digit
        const randomDigit = Math.floor(Math.random() * 10)
        suffix += randomDigit
        handle = `${userName}_${suffix}.${ctx.cfg.service.hostname}`
        handleAcct = await ctx.accountManager.getAccount(handle)

        // Safety: prevent infinite loop (extremely unlikely)
        if (suffix.length > 10) {
          req.log.error({ userName, suffix }, 'Unable to generate unique handle after 10 attempts')
          return res.status(500).json({
            error: 'HandleGenerationFailed',
            message: 'Unable to generate unique handle'
          })
        }
      }

      req.log.info({ legalId, email, handle, userName }, 'Auto-provisioning account from Neuro')

      // Step 12: Create account with retry logic for handle conflicts
      let accountCreated = false
      let retryCount = 0
      const maxRetries = 5
      let did: string

      while (!accountCreated && retryCount < maxRetries) {
        try {
          // Create DID and account
          const signingKey = await ctx.actorStore.reserveKeypair()
          did = await ctx.plcClient.createDid({
            signingKey: signingKey.did(),
            handle,
            pds: ctx.cfg.service.publicUrl,
            signer: ctx.plcRotationKey,
          })

          await ctx.actorStore.create(did, signingKey)

          const commit = await ctx.actorStore.transact(did, (actorTxn) =>
            actorTxn.repo.createRepo([])
          )

          // Create account with Legal ID as "password"
          await ctx.accountManager.createAccount({
            did,
            handle,
            email,
            password: legalId, // Store Legal ID as password hash
            repoCid: commit.cid,
            repoRev: commit.rev,
          })

          // Step 13: Link Neuro identity
          await ctx.neuroAuthManager.linkIdentity(legalId, did, email, userName)

          // Step 14: Sequence events
          await ctx.sequencer.sequenceIdentityEvt(did, handle)
          await ctx.sequencer.sequenceAccountEvt(did, 'active')
          await ctx.sequencer.sequenceCommit(did, commit)

          // Step 15: Store nonce AFTER successful account creation
          // This allows retry if provisioning failed earlier
          await ctx.accountManager.db.db
            .insertInto('neuro_provision_nonce')
            .values({
              nonce,
              legalId,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
            })
            .execute()

          accountCreated = true
          req.log.info({ did, handle, legalId }, 'Account auto-provisioned successfully')

          return res.status(201).json({
            success: true,
            did,
            handle,
            legalId
          })

        } catch (err) {
          // Check if error is due to handle conflict
          const errorMsg = err instanceof Error ? err.message.toLowerCase() : ''
          const isHandleConflict = errorMsg.includes('handle') ||
                                   errorMsg.includes('unique') ||
                                   errorMsg.includes('constraint')

          if (isHandleConflict && retryCount < maxRetries - 1) {
            // Handle taken during creation - regenerate and retry
            retryCount++
            const randomDigit = Math.floor(Math.random() * 10)
            suffix += randomDigit
            handle = `${userName}_${suffix}.${ctx.cfg.service.hostname}`
            req.log.warn({
              previousHandle: `${userName}_${suffix.slice(0, -1)}.${ctx.cfg.service.hostname}`,
              newHandle: handle,
              retryCount,
              error: errorMsg
            }, 'Handle conflict during creation, retrying with new suffix')
            continue // Retry with new handle
          }

          // Not a handle conflict or max retries reached
          req.log.error({ err, legalId, email, handle, retryCount }, 'Failed to provision account')
          return res.status(500).json({
            error: 'ProvisionFailed',
            message: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      // If we get here, max retries exceeded
      req.log.error({ legalId, userName, retryCount }, 'Max retries exceeded for handle generation')
      return res.status(500).json({
        error: 'ProvisionFailed',
        message: 'Unable to generate unique handle after multiple attempts'
      })
    }
  })
}
```

### Step 2: Add Nonce Tracking Table

**File:** `packages/pds/src/account-manager/db/migrations/009-neuro-provision-nonce.ts`

```typescript
import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('neuro_provision_nonce')
    .addColumn('nonce', 'varchar', (col) => col.primaryKey())
    .addColumn('legalId', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .execute()

  // Index for cleanup queries
  await db.schema
    .createIndex('neuro_provision_nonce_expires_idx')
    .on('neuro_provision_nonce')
    .column('expiresAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('neuro_provision_nonce').execute()
}
```

**Add to migrations index:**

`packages/pds/src/account-manager/db/migrations/index.ts`

```typescript
import * as _009 from './009-neuro-provision-nonce'

export const migrations = [
  // ... existing migrations
  _009,
]
```

### Step 3: Register Endpoint

**File:** `packages/pds/src/basic-routes.ts`

Add after existing neuro routes:

```typescript
import provisionAccount from './api/neuro/provisionAccount'

// In the route registration section:
if (ctx.cfg.neuro?.enabled) {
  // ... existing neuro routes
  provisionAccount(server, ctx)
}
```

### Step 4: Disable Invite Codes (Optional)

**File:** `packages/pds/src/config/env.ts`

```typescript
// Change invite configuration
invites: {
  required: envBool('PDS_INVITES_REQUIRED') ?? false, // Set to false
  interval: envInt('PDS_INVITE_INTERVAL'),
  epoch: envInt('PDS_INVITE_EPOCH'),
},
```

Or in your startup script:

```bash
-e PDS_INVITES_REQUIRED=false \
```

### Step 5: Update linkIdentity Method (if needed)

**File:** `packages/pds/src/account-manager/helpers/neuro-auth-manager.ts`

Ensure `linkIdentity` accepts optional userName:

```typescript
async linkIdentity(
  legalId: string,
  did: string,
  email?: string,
  userName?: string  // Add this parameter
): Promise<void> {
  // ... existing validation

  await this.db.db
    .insertInto('neuro_identity_link')
    .values({
      neuroJid: legalId,  // Store Legal ID in neuroJid column
      did,
      email: email || null,
      userName: userName || null,  // Store userName
      linkedAt: new Date().toISOString(),
      lastLoginAt: null,
    })
    .execute()
}
```

---

## Configuration

### Environment Variables

Add to your startup script or `.env`:

```bash
# Existing Neuro config
PDS_NEURO_ENABLED=true
PDS_NEURO_DOMAIN=lab.tagroot.io
PDS_NEURO_API_TYPE=remotelogin
PDS_NEURO_AUTH_METHOD=basic
PDS_NEURO_BASIC_USERNAME=JanLindblad
PDS_NEURO_BASIC_PASSWORD=...

# New: Disable invites for auto-provisioned accounts
PDS_INVITES_REQUIRED=false

# Future: mTLS configuration
# PDS_NEURO_MTLS_CERT_PATH=/path/to/client-cert.pem
# PDS_NEURO_MTLS_KEY_PATH=/path/to/client-key.pem
# PDS_NEURO_MTLS_CA_PATH=/path/to/ca-cert.pem
```

---

## Testing

### Manual Testing with curl

```bash
# Test successful provision
curl -X POST http://localhost:2583/neuro/provision/account \
  -H "Content-Type: application/json" \
  -d '{
    "legalId": "12345678-1234-1234-1234-123456789012@legal.lab.tagroot.io",
    "email": "testuser@example.com",
    "userName": "testuser",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "nonce": "'$(uuidgen)'"
  }'
 (matching Neuro's actual payload structure)
curl -X POST http://localhost:2583/neuro/provision/account \
  -H "Content-Type: application/json" \
  -d '{
    "Timestamp": '$(date +%s)',
    "Type": "Informational",
    "Level": "Medium",
    "EventId": "AccountCreated",
    "Object": "testuser",
    "Actor": "",
    "Facility": "",
    "Module": "",
    "Message": "Account created.",
    "Tags": {
      "ApiKey": "test-api-key-'$(date +%s)'",
      "Created": '$(date +%s)',
      "Updated": null,
      "EMail": "testuser@example.com",
      "PhoneNr": "",
      "Enabled": true,
      "ObjectId": "12345678-1234-1234-1234-123456789012",
      "RemoteEndpoint": "127.0.0.1:12345",
      "City": "Test City",
      "Region": "Test Region",
      "Country": "Test Country",
      "Code": "TC",
      "Flag": ":flag-tc:",
      "Latitude": 0.0,
      "Longitude": 0.0,
      "Acknowledgement": "Test"
    },
    "StackTrace": ""
  }'

# Expected response (201):
{
  "success": true,
  "did": "did:plc:...",
  "handle": "testuser.jarlix.ngrok.dev",
  "legalId": "12345678-1234-1234-1234-123456789012@legal.lab.tagroot.io"
}

# Test with missing email (should use noreply@wsocial.eu)
curl -X POST http://localhost:2583/neuro/provision/account \
  -H "Content-Type: application/json" \
  -d '{
    "Timestamp": '$(date +%s)',
    "Type": "Informational",
    "Level": "Medium",
    "EventId": "AccountCreated",
    "Object": "testuser2",
    "Message": "Account created.",
    "Tags": {
      "ApiKey": "test-api-key-'$(date +%s)'",
      "EMail": "",
      "ObjectId": "22345678-1234-1234-1234-123456789012",
      "Enabled": true
    }
  }'

# Expected: Account created with email "noreply@wsocial.eu"

# Test duplicate (should be idempotent, return 200)
# Rerun with DIFFERENT ApiKey but same ObjectId
curl -X POST http://localhost:2583/neuro/provision/account \
  -H "Content-Type: application/json" \
  -d '{
    "Timestamp": '$(date +%s)',
    "EventId": "AccountCreated",
    "Object": "testuser",
    "Tags": {
      "ApiKey": "different-api-key-'$(date +%s)'",
      "EMail": "testuser@example.com",
      "ObjectId": "12345678-1234-1234-1234-123456789012"
    }
  }'

# Expected response (200):
{
  "success": true,
  "alreadyExists": true,
  "did": "did:plc:...",
  "handle": "testuser.jarlix.ngrok.dev"
}

# Test nonce replay (should fail)
APIKEY="fixed-api-key-$(date +%s)"
TIMESTAMP=$(date +%s)

# First request
curl -X POST http://localhost:2583/neuro/provision/account \
  -H "Content-Type: application/json" \
  -d '{
    "Timestamp": '$TIMESTAMP',
    "EventId": "AccountCreated",
    "Object": "newuser",
    "Tags": {
      "ApiKey": "'$APIKEY'",
      "EMail": "new@example.com",
      "ObjectId": "33345678-1234-1234-1234-123456789012"
    }
  }'

# Second request with SAME ApiKey (should fail with 400)
curl -X POST http://localhost:2583/neuro/provision/account \
  -H "Content-Type: application/json" \
  -d '{
    "Timestamp": '$TIMESTAMP',
    "EventId": "AccountCreated",
    "Object": "newuser",
    "Tags": {
      "ApiKey": "'$APIKEY'",
      "EMail": "new@example.com",
      "ObjectId": "33345678-1234-1234-1234-123456789012"
    }
  }'

# Expected response (400):
{
  "error": "NonceReused",
  "message": "This nonce has already been used"
}

# Test invalid EventId (should fail)
curl -X POST http://localhost:2583/neuro/provision/account \
  -H "Content-Type: application/json" \
  -d '{
    "Timestamp": '$(date +%s)',
    "EventId": "SomethingElse",
    "Object": "testuser",
    "Tags": {
      "ApiKey": "test-'$(date +%s)'",
      "ObjectId": "44345678-1234-1234-1234-123456789012"
    }
  }'

# Expected response (400):
{
  "error": "InvalidEventType",
  "message": "Expected EventId \"AccountCreated\", got \"SomethingElse\""
}
  -d '{
    "identifier": "testuser.jarlix.ngrok.dev",
    "password": "12345678-1234-1234-1234-123456789012@legal.lab.tagroot.io"
  }'

# Should initiate RemoteLogin petition, approve in Neuro app, get JWT tokens
```

### Database Verification

```bash
# Check account was created
docker exec -i pds-remotelogin sqlite3 /pds/pds.sqlite << EOF
SELECT did, handle, email FROM account WHERE handle LIKE 'testuser%';
EOF

# Check Neuro identity link (using Legal ID)
docker exec -i pds-remotelogin sqlite3 /pds/pds.sqlite << EOF
SELECT neuroJid, did, userName FROM neuro_identity_link WHERE userName = 'testuser';
EOF

# Verify Legal ID is stored (should be uuid@legal.domain)
docker exec -i pds-remotelogin sqlite3 /pds/pds.sqlite << EOF
SELECT neuroJid FROM neuro_identity_link ORDER BY linkedAt DESC LIMIT 5;
EOF
# Expected: "30f1584b-51c7-9d65-1810-15d5f9e42b4a@legal.lab.tagroot.io" (Legal ID format)
# Has @legal. domain indicator

# Check nonce was stored
docker exec -i pds-remotelogin sqlite3 /pds/pds.sqlite << EOF
SELECT nonce, legalId, createdAt FROM neuro_provision_nonce ORDER BY createdAt DESC LIMIT 5;
EOF
```

---

## Security Considerations

### Phase 1: Naked (Development Only)

- No authentication on callback endpoint
- **ONLY USE ON PRIVATE NETWORKS OR DURING DEVELOPMENT**
- Anyone can provision accounts if they know the endpoint

### Phase 2: mTLS (Production)

**Server-side validation:**

```typescript
// In provisionAccount.ts handler
const clientCert = req.socket.getPeerCertificate()

if (!clientCert || !clientCert.subject) {
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Valid client certificate required'
  })
}

// Validate certificate CN or other fields
const allowedCN = ctx.cfg.neuro.mtlsAllowedCN
if (clientCert.subject.CN !== allowedCN) {
  return res.status(403).json({
    error: 'Forbidden',
    message: 'Client certificate not authorized'
  })
}
```

**Caddy configuration (for TLS termination with mTLS):**

```caddyfile
jarlix.ngrok.dev {
  # mTLS for /neuro/provision/* endpoints
  @neuro_provision {
    path /neuro/provision/*
  }
  handle @neuro_provision {
    tls {
      client_auth {
        mode require_and_verify
        trusted_ca_cert_file /path/to/ca-cert.pem
      }
    }
    reverse_proxy localhost:2583
  }

  # Other endpoints don't require client cert
  handle {
    reverse_proxy localhost:2583
  }
}
```

**Short-term approach:** Configure Caddy to require mTLS for the callback endpoint.

**Long-term architecture:** Consider running callback handling in a separate container:
- Decouples callback handling from individual PDS instances
- Enables callback buffering and routing
- Handles scenarios where some PDS instances may be temporarily down
- Future: One callback URL routes to many PDS instances

---

## Cleanup Tasks

### Nonce Expiration

Add periodic cleanup to remove expired nonces:

**File:** `packages/pds/src/account-manager/helpers/neuro-auth-manager.ts`

```typescript
/**
 * Clean up expired provision nonces (run daily)
 */
async cleanupExpiredNonces(): Promise<void> {
  if (!this.db) return

  const now = new Date().toISOString()

  const result = await this.db.db
    .deleteFrom('neuro_provision_nonce')
    .where('expiresAt', '<', now)
    .execute()

  this.logger?.info({ deletedCount: result.length }, 'Cleaned up expired provision nonces')
}
```

Schedule in main app initialization:

```typescript
// In packages/pds/src/index.ts or similar
if (ctx.neuroAuthManager) {
  // Run cleanup daily
  setInterval(() => {
    ctx.neuroAuthManager?.cleanupExpiredNonces()
  }, 24 * 60 * 60 * 1000)
}
```

---

## Neuro Integration

### Callback Configuration

Neuro team needs to configure:

```javascript
// Neuro server config
{
  provisioning: {
    enabled: true,
    pdsUrl: "https://jarlix.ngrok.dev/neuro/provision/account",
    onAccountCreated: true,  // Trigger callback when account created
    retryAttempts: 3,
    retryDelay: 5000  // ms
  }
}
```

### Error Handling

Neuro should handle these responses:

- `201 Created` → Account provisioned successfully
- `200 OK` → Account already exists (idempotent)
- `400 Bad Request` → Invalid payload or expired timestamp
- `409 Conflict` → Email already taken
- `500 Server Error` → Retry later

---

## Migration Path

### For Existing Users

Users who already created accounts manually:

1. **No action needed** - they're already linked
2. Callback will return `alreadyExists: true`
3. They continue using RemoteLogin as normal

### Rollout Strategy

1. **Phase 1**: Deploy endpoint with naked auth (dev/staging)
2. **Phase 2**: Test with small group of new Neuro users
3. **Phase 3**: Enable mTLS authentication
4. **Phase 4**: Production rollout

---

## Monitoring

### Metrics to Track

- Provision requests per hour
- Success rate (201 vs errors)
- Handle collision rate (requires random suffix)
- Nonce reuse attempts (security concern)
- Average provision time

### Logging

```typescript
req.log.info({
  legalId,
  did,
  handle,
  userName,
  handleModified: handle.includes(userName) && handle !== `${userName}.${hostname}`,
  duration: Date.now() - startTime
}, 'Account provisioned via Neuro callback')
```

---

## Future Enhancements

1. **Signature Verification**: Add HMAC or JWT signature validation
2. **Rate Limiting**: Per-IP or per-Neuro-instance limits
3. **Webhooks**: Notify Neuro of provision failures
4. **Bulk Provisioning**: Accept array of users in single request
5. **Account Linking**: Allow existing Bluesky users to link Neuro ID later
6. **Email Verification**: Send welcome email with instructions

---

## Troubleshooting

### Account Created But Not Linked

Check logs for linkIdentity errors:

```bash
docker logs pds-remotelogin | grep "linkIdentity\|provision"
```

### Handle Generation Issues

Check database for handle conflicts:

```sql
SELECT handle, did FROM account WHERE handle LIKE '%testuser%';
```

### Nonce Table Growing Too Large

Verify cleanup job is running:

```bash
docker exec -i pds-remotelogin sqlite3 /pds/pds.sqlite << EOF
SELECT COUNT(*) as total,
       SUM(CASE WHEN expiresAt < datetime('now') THEN 1 ELSE 0 END) as expired
FROM neuro_provision_nonce;
EOF
```

---

## Pre-Implementation Review

### ✅ Verified Correct:

1. **Event Processing Flow**
   - ✅ Only processes `LegalIdUpdated` with `State='Approved'`
   - ✅ Logs and ignores other events (AccountCreated, LegalIdRegistered, non-Approved states)
   - ✅ All 5 states documented: Created, Rejected, Approved, Obsoleted, Compromised

2. **Nonce Strategy**
   - ✅ Composite hash of `EventId:Timestamp:Object:Actor` solves 1s timestamp resolution
   - ✅ Checked before processing to prevent replay attacks
   - ✅ Checks for existing account BEFORE storing nonce (prevents pollution)
   - ✅ **NOW STORED AFTER SUCCESSFUL ACCOUNT CREATION** (allows retry on failure)

3. **Handle Generation**
   - ✅ Digit appending strategy: john → john_3 → john_39 → john_391
   - ✅ Happens BEFORE account creation (correct order)
   - ✅ Safety limit of 10 digits prevents infinite loops
   - ✅ **RETRY LOGIC ADDED** for handle conflicts during creation (max 5 retries)

4. **Idempotency**
   - ✅ Checks for existing Legal ID link
   - ✅ Returns 200 with existing account info
   - ✅ Now happens before nonce storage (optimization)

5. **Email Handling**
   - ✅ Falls back to noreply@wsocial.eu
   - ✅ Skips uniqueness check for noreply address

6. **Timestamp Validation**
   - ✅ **INCREASED TO 10 MINUTES** (from 5 minutes)
   - ✅ More forgiving for network delays
   - ✅ Still prevents replay of old events

### ✅ Implementation Improvements Applied:

1. **Nonce Storage Timing - IMPLEMENTED**
   - ✅ Moved to Step 15, AFTER successful account creation
   - ✅ If provisioning fails, nonce is NOT stored - retry is possible
   - ✅ Prevents nonce table pollution from failed attempts

2. **Handle Conflict Retry - IMPLEMENTED**
   - ✅ Wrapped account creation in retry loop (max 5 attempts)
   - ✅ Detects handle conflicts via error message keywords
   - ✅ Generates new handle with additional random digit and retries
   - ✅ Proper error logging for debugging

3. **Timestamp Window - IMPLEMENTED**
   - ✅ Increased from 5 minutes to 10 minutes
   - ✅ More forgiving for network delays

### ⚠️ Remaining Considerations:

1. **Password Storage**
   - The code stores Legal ID as password: `password: legalId`
   - `createAccount` will hash this, which is fine for RemoteLogin
   - But users won't be able to login with traditional password (intended behavior)
   - ✅ This is correct - RemoteLogin only, no password-based login

2. **createAccount May Duplicate Validation**
   - We check email uniqueness, but `createAccount` likely does too
   - Not a bug, just redundant - consider removing our check
   - But keeping it provides better error messages
   - ✅ Acceptable - fail fast with specific error

3. **Missing Database Schema Type**
   - Guide mentions creating schema types file but doesn't show it
   - ℹ️ **Info:** May need to add TypeScript types for neuro_provision_nonce table

### 📋 Implementation Checklist:

Before coding:
- [x] Move nonce storage to after account creation (IMPLEMENTED)
- [x] Add handle conflict retry logic (IMPLEMENTED)
- [x] Increase timestamp validation window to 10 minutes (IMPLEMENTED)
- [ ] Create neuro_provision_nonce TypeScript types
- [ ] Verify neuroAuthManager.linkIdentity signature matches

During coding:
- [ ] Import crypto module
- [ ] Handle all async errors properly
- [ ] Add comprehensive logging at each step
- [ ] Test idempotency with duplicate callbacks
- [ ] Test all 5 state values

After coding:
- [ ] Run migration to create nonce table
- [ ] Test with real Neuro callbacks
- [ ] Verify nonce cleanup job runs
- [ ] Monitor for handle conflicts
- [ ] Check logs for all state transitions

---

## Summary

**Key Points:**
- Process `LegalIdUpdated` events with `State="Approved"` only
- Use Legal ID as stable identifier (can change every ~2 years with grace period)
- Composite nonce strategy prevents replay attacks
- Handle generation with digit appending (john → john_3 → john_39)
- **Retry logic for handle conflicts** (max 5 attempts)
- **Nonce stored AFTER successful account creation** (enables retry on failure)
- **10-minute timestamp validation window** (forgiving for network delays)
- Caddy mTLS for short-term security
- Future: Separate container for callback routing

**Files to Create:**
1. `packages/pds/src/api/neuro/provisionAccount.ts` - Main endpoint
2. `packages/pds/src/account-manager/db/migrations/009-neuro-provision-nonce.ts` - Nonce table
3. `packages/pds/src/account-manager/db/schema/neuro-provision-nonce.ts` - Schema types

**Files to Modify:**
1. `packages/pds/src/basic-routes.ts` - Register endpoint
2. `packages/pds/src/account-manager/db/migrations/index.ts` - Add migration
3. `packages/pds/src/account-manager/helpers/neuro-auth-manager.ts` - Add cleanup method
4. `start-pds-oauth-remotelogin.sh` - Set PDS_INVITES_REQUIRED=false

**Implementation Improvements:**
- ✅ Nonce storage moved to Step 15 (after successful account creation)
- ✅ Handle conflict retry logic (5 attempts with random digit appending)
- ✅ Timestamp validation increased to 10 minutes

**Estimated Implementation Time:** 4-6 hours

**Testing Time:** 2-3 hours

**Total:** ~1 day of development work
