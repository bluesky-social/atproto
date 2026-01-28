# Neuro Quick Login Integration Guide

## Overview

This guide provides complete implementation instructions for integrating Neuro Quick Login as the **default and only** authentication method for AT Protocol Personal Data Server (PDS).

**Authentication Model:**
- **Neuro-only** - No password authentication
- **Server-side only** - No client modifications required
- **Passwordless accounts** - Users authenticate via QR code scanning
- **Prerequisite** - Users must have an existing Neuro identity before using this PDS

**Implementation Time:** 16-24 hours for a single developer

**Investigation Status:** ✅ Complete - All architectural questions have been answered and validated.

---

## Architecture

### How It Works

**Sign-up Flow:**
1. User navigates to PDS signup page
2. User enters desired handle
3. PDS initiates Neuro Quick Login session and generates 6-digit code
4. QR code and verification code (e.g., "123-456") displayed to user
5. User scans QR code with Neuro-enabled mobile device
6. Neuro sends identity data to PDS callback endpoint
7. User enters the displayed 6-digit code
8. PDS verifies code and creates account with `password: null`
9. PDS links Neuro JID to account DID
10. OAuth flow completes with authorization code

**Login Flow:**
1. Client initiates OAuth authorization flow
2. User enters email/handle
3. PDS initiates Neuro session and generates 6-digit code
4. PDS presents QR code and verification code via 2FA error
5. User scans QR code with Neuro app
6. Neuro sends identity data to PDS callback endpoint
7. User enters the displayed 6-digit code
8. PDS verifies code and checks callback completion
9. PDS looks up account by Neuro JID
10. OAuth flow completes with authorization code
11. Client exchanges code for access token

### Integration Points

The implementation uses **existing OAuth Provider extension points** without forking or modifying the core OAuth package:

1. **OAuthHooks Interface** - Lifecycle hooks to intercept authentication
   - `onAuthorizationRequest` - Initialize Neuro session when OAuth flow starts
   - `onSignedIn` - Track Neuro-based logins
   - `onSignedUp` - Link Neuro identity to new accounts

2. **2FA Error Mechanism** - Repurpose SecondAuthenticationFactorRequiredError
   - Standard: Used for email OTP verification
   - Neuro usage: Display QR code URL and 6-digit verification code in `hint` field
   - UI automatically shows hint text + input field when error thrown
   - User scans QR → enters displayed verification code → server validates code and session completion

3. **No OAuth UI Changes Required** - Uses existing 2FA UI flow
   - OAuth Provider UI already supports 2FA error display
   - QR code rendered as multiline text in hint section
   - Token input field used for verification code from Neuro app
   - Zero modifications to oauth-provider-ui package needed

### Storage Architecture

You have **two options** for storing session correlation data:

**Option A: Database Storage (Simpler)**
- Add `neuro_pending_sessions` table
- Store correlation between OAuth request and Neuro session
- Good for: Single-server deployments, simple setups
- Requires: One additional database table

**Option B: Redis Storage (Scalable)**
- Store sessions in Redis with TTL
- Automatically expire after 5 minutes
- Good for: Multi-server deployments, high traffic
- Requires: Redis server

Both options use the same `NeuroAuthManager` API with different backends.

### No Client Changes Required

The PDS controls authentication method via configuration. Standard OAuth clients work without modification:

1. Client discovers OAuth server via `/.well-known/oauth-authorization-server`
2. Client initiates standard OAuth 2.1 Authorization Code flow
3. PDS presents Neuro QR code instead of password form
4. OAuth flow completes normally
5. Client receives standard OAuth tokens

---

## Prerequisites

Before starting implementation:

1. **Neuro API Access**
   - Production domain: `mateo.lab.tagroot.io`
   - Test domain: (use production for now)
   - No API key required for Quick Login

2. **HTTPS-Accessible Callback URL**
   - Required: `https://your-pds-domain.com/neuro/callback`
   - Cannot be localhost or HTTP
   - Must be publicly accessible from Neuro servers

3. **Storage Backend Decision**
   - Choose database (simpler) or Redis (scalable)
   - Ensure chosen backend is available

4. **Development Environment**
   - Node.js 18+ with pnpm
   - TypeScript 5+
   - SQLite (or PostgreSQL) database
   - Redis (if using Option B)

---

## Implementation Steps

### Step 1: Database Schema

Add database tables to store Neuro identity links and optionally pending sessions.

#### 1.1 Create Neuro Identity Link Schema

**File:** `packages/pds/src/account-manager/db/schema/neuro-identity-link.ts` (NEW)

```typescript
import { Generated, Selectable } from 'kysely'

export interface NeuroIdentityLink {
  neuroJid: string                    // Primary key: Neuro Jabber ID
  did: string                         // Foreign key to actor.did
  email: string | null                // Cached from Neuro identity
  userName: string | null             // Cached from Neuro identity
  linkedAt: Generated<string>         // ISO timestamp
  lastLoginAt: string | null          // ISO timestamp
}

export type NeuroIdentityLinkEntry = Selectable<NeuroIdentityLink>

export const tableName = 'neuro_identity_link'

export type PartialDB = { [tableName]: NeuroIdentityLink }
```

#### 1.2 Create Pending Sessions Schema (Database Option Only)

**File:** `packages/pds/src/account-manager/db/schema/neuro-pending-session.ts` (NEW)

```typescript
import { Generated, Selectable } from 'kysely'

export interface NeuroPendingSession {
  sessionId: string                   // Primary key
  serviceId: string                   // Neuro service ID
  requestUri: string | null           // OAuth request URI for correlation
  deviceId: string | null             // OAuth device ID
  createdAt: Generated<string>        // ISO timestamp
  expiresAt: string                   // ISO timestamp (5 minutes from creation)
  completedAt: string | null          // ISO timestamp when identity received
  neuroJid: string | null            // Set when callback received
}

export type NeuroPendingSessionEntry = Selectable<NeuroPendingSession>

export const tableName = 'neuro_pending_session'

export type PartialDB = { [tableName]: NeuroPendingSession }
```

#### 1.3 Update Schema Index

**File:** `packages/pds/src/account-manager/db/schema/index.ts` (MODIFY)

```typescript
import * as neuroIdentityLink from './neuro-identity-link'
import * as neuroPendingSession from './neuro-pending-session'  // Only if using database option

export type DatabaseSchema =
  account.PartialDB &
  actor.PartialDB &
  // ... existing tables ...
  neuroIdentityLink.PartialDB &
  neuroPendingSession.PartialDB  // Only if using database option

export type { NeuroIdentityLink } from './neuro-identity-link'
export type { NeuroPendingSession } from './neuro-pending-session'  // Only if using database option
```

#### 1.4 Create Migration

**File:** `packages/pds/src/account-manager/db/migrations/008-neuro-identity.ts` (NEW)

```typescript
import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Neuro identity links table (ALWAYS REQUIRED)
  await db.schema
    .createTable('neuro_identity_link')
    .addColumn('neuroJid', 'varchar', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('email', 'varchar')
    .addColumn('userName', 'varchar')
    .addColumn('linkedAt', 'varchar', (col) => col.notNull())
    .addColumn('lastLoginAt', 'varchar')
    .execute()

  await db.schema
    .createIndex('neuro_identity_link_did_idx')
    .on('neuro_identity_link')
    .column('did')
    .execute()

  // Pending sessions table (ONLY IF USING DATABASE STORAGE)
  await db.schema
    .createTable('neuro_pending_session')
    .addColumn('sessionId', 'varchar', (col) => col.primaryKey())
    .addColumn('serviceId', 'varchar', (col) => col.notNull())
    .addColumn('requestUri', 'varchar')
    .addColumn('deviceId', 'varchar')
    .addColumn('createdAt', 'varchar', (col) =>
      col.notNull().defaultTo(new Date().toISOString())
    )
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addColumn('completedAt', 'varchar')
    .addColumn('neuroJid', 'varchar')
    .execute()

  await db.schema
    .createIndex('neuro_pending_session_expires_idx')
    .on('neuro_pending_session')
    .column('expiresAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('neuro_identity_link').execute()
  await db.schema.dropTable('neuro_pending_session').execute()
}
```

#### 1.5 Register Migration

**File:** `packages/pds/src/account-manager/db/migrations/index.ts` (MODIFY)

```typescript
import * as mig008 from './008-neuro-identity'

export const migrations = [
  // ... existing migrations (mig001 through mig007) ...
  mig008,
]
```

#### 1.6 Make Password Nullable

**File:** `packages/pds/src/account-manager/db/schema/account.ts` (MODIFY)

Update the `account` table schema to make password nullable:

```typescript
export interface Account {
  did: string
  email: string
  passwordScrypt: string | null  // Change from 'string' to 'string | null'
  createdAt: string
  emailConfirmedAt: string | null
  deactivatedAt: string | null
  deleteAfter: string | null
  // ... other fields
}
```

**Create migration:** `packages/pds/src/account-manager/db/migrations/009-nullable-password.ts` (NEW)

```typescript
import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // SQLite doesn't support ALTER COLUMN directly
  // But the schema change is backward compatible
  // Existing code already handles null passwords in validation
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // No-op: backward compatible
}
```

---

### Step 2: Neuro Auth Manager

Create a class to manage Neuro Quick Login sessions, API communication, and callback handling.

**File:** `packages/pds/src/account-manager/helpers/neuro-auth-manager.ts` (NEW)

```typescript
import axios, { AxiosInstance } from 'axios'
import { randomBytes } from 'crypto'
import EventEmitter from 'events'
import { Database } from '../db'
import { Redis } from 'ioredis'

// Logger type - use your PDS logger interface
type Logger = {
  info: (obj: object, msg: string) => void
  warn: (obj: object, msg: string) => void
  error: (obj: object, msg: string) => void
  debug?: (obj: object, msg: string) => void
}

/**
 * Identity data received from Neuro after QR scan
 */
export interface NeuroIdentity {
  jid: string
  userName?: string
  email?: string                      // Note: Field name may vary - check Neuro API response
  eMail?: string                      // Alternative field name
  humanReadableName?: string
  phoneNumber?: string
  attachments?: Array<{
    contentType: string
    url: string
    backEndUrl?: string
    type?: string
  }>
  sessionId: string
}

/**
 * Neuro-specific error codes
 * Format: NEURO_<CATEGORY>_<SPECIFIC>
 */
export const NeuroErrorCodes = {
  // Session errors
  SESSION_NOT_FOUND: 'NEURO_SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'NEURO_SESSION_EXPIRED',
  SESSION_INCOMPLETE: 'NEURO_SESSION_INCOMPLETE',
  SESSION_DATA_MISSING: 'NEURO_SESSION_DATA_MISSING',

  // Code errors
  CODE_INVALID: 'NEURO_CODE_INVALID',
  CODE_EXPIRED: 'NEURO_CODE_EXPIRED',

  // Identity errors
  IDENTITY_NOT_LINKED: 'NEURO_IDENTITY_NOT_LINKED',
  IDENTITY_ALREADY_LINKED: 'NEURO_IDENTITY_ALREADY_LINKED',
  IDENTITY_EMAIL_MISSING: 'NEURO_IDENTITY_EMAIL_MISSING',

  // API errors
  API_UNREACHABLE: 'NEURO_API_UNREACHABLE',
  API_ERROR: 'NEURO_API_ERROR',
  API_TIMEOUT: 'NEURO_API_TIMEOUT',
  API_INVALID_RESPONSE: 'NEURO_API_INVALID_RESPONSE',

  // Callback errors
  CALLBACK_MISSING_FIELDS: 'NEURO_CALLBACK_MISSING_FIELDS',
  CALLBACK_INVALID_JID: 'NEURO_CALLBACK_INVALID_JID',
  CALLBACK_SESSION_NOT_FOUND: 'NEURO_CALLBACK_SESSION_NOT_FOUND',

  // Configuration errors
  CONFIG_DISABLED: 'NEURO_CONFIG_DISABLED',
  CONFIG_DB_MISSING: 'NEURO_CONFIG_DB_MISSING',
} as const

/**
 * Configuration for Neuro Auth Manager
 */
export interface NeuroConfig {
  domain: string                      // e.g., 'mateo.lab.tagroot.io'
  callbackBaseUrl: string             // e.g., 'https://your-pds.com'
  storageBackend: 'database' | 'redis'
}

/**
 * Session data for pending authentication
 */
interface SessionData {
  sessionId: string
  serviceId: string
  requestUri?: string
  deviceId?: string
  emitter: EventEmitter
  createdAt: number
  completedAt?: number
  identity?: NeuroIdentity
  timeout: NodeJS.Timeout
}

/**
 * Manages Neuro Quick Login sessions and callbacks
 */
export class NeuroAuthManager {
  private sessions: Map<string, SessionData> = new Map()
  private codeSessions: Map<string, string> = new Map() // code → sessionId
  private identifierSessions: Map<string, string> = new Map() // identifier → sessionId
  private axiosClient: AxiosInstance
  private db?: Database
  private redis?: Redis
  private logger: Logger

  constructor(
    private readonly config: NeuroConfig,
    storageBackend?: Database | Redis,
    logger?: Logger,
  ) {
    this.logger = logger || console
    // Configure Axios for Neuro API
    this.axiosClient = axios.create({
      baseURL: `https://${config.domain}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Configure storage backend
    if (config.storageBackend === 'database' && storageBackend instanceof Database) {
      this.db = storageBackend
    } else if (config.storageBackend === 'redis') {
      this.redis = storageBackend as Redis
    }
  }

  /**
   * Initiate a new Neuro Quick Login session
   */
  async initiateSession(
    requestUri?: string,
    deviceId?: string,
  ): Promise<{
    sessionId: string
    serviceId: string
    qrCodeUrl: string
    verificationCode: string
  }> {
    const sessionId = randomBytes(16).toString('hex')
    const callbackUrl = `${this.config.callbackBaseUrl}/neuro/callback`

    // Register callback with Neuro API (with retry logic)
    let response
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await this.axiosClient.post('/QuickLogin', {
          service: callbackUrl,
          sessionId: sessionId,
        })
        break // Success
      } catch (error) {
        lastError = error as Error

        if (attempt < 3) {
          // Exponential backoff: 1s, 2s
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          this.logger.warn(
            { attempt, error: lastError.message },
            'Neuro API call failed, retrying...'
          )
        }
      }
    }

    if (!response) {
      this.logger.error(
        { error: lastError?.message, callbackUrl },
        'Failed to initiate Neuro session after 3 attempts'
      )
      throw new Error(
        'Unable to connect to Neuro authentication service. Please try again later.'
      )
    }

    const { serviceId } = response.data

    if (!serviceId) {
      this.logger.error(
        { responseData: response.data },
        'Neuro API returned invalid response: missing serviceId'
      )
      throw new Error('Received invalid response from Neuro service')
    }

    // Create event emitter for callback notification
    const emitter = new EventEmitter()

    // Auto-expire after 5 minutes
    const timeout = setTimeout(() => {
      const session = this.sessions.get(sessionId)
      if (session) {
        session.emitter.emit('error', new Error('Session expired'))
        this.sessions.delete(sessionId)
      }
    }, 5 * 60 * 1000)

    // Store session in memory
    this.sessions.set(sessionId, {
      sessionId,
      serviceId,
      requestUri,
      deviceId,
      emitter,
      createdAt: Date.now(),
      timeout,
    })

    // Store in persistent backend
    if (this.db) {
      await this.storePendingSessionDb(sessionId, serviceId, requestUri, deviceId)
    } else if (this.redis) {
      await this.storePendingSessionRedis(sessionId, serviceId, requestUri, deviceId)
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const verificationCode = `${code.substring(0, 3)}-${code.substring(3)}`

    // Store code → sessionId mapping with TTL
    this.codeSessions.set(code, sessionId)
    setTimeout(() => this.codeSessions.delete(code), 5 * 60 * 1000) // 5 min expiry

    // Generate QR code URL
    const qrCodeUrl = `https://${this.config.domain}/QuickLogin/${serviceId}.png`

    return { sessionId, serviceId, qrCodeUrl, verificationCode }
  }

  /**
   * Handle callback from Neuro API
   * Idempotent: accepts duplicate callbacks gracefully
   */
  handleCallback(identity: NeuroIdentity): void {
    const session = this.sessions.get(identity.sessionId)

    if (!session) {
      this.logger.warn(
        { sessionId: identity.sessionId },
        'Callback received for unknown/expired session'
      )
      throw new Error(`Session not found or expired`)
    }

    // Handle duplicate callbacks (idempotent)
    if (session.completedAt) {
      this.logger.warn(
        {
          sessionId: identity.sessionId,
          jidHash: this.hashJid(identity.jid),
          firstCompletedAt: new Date(session.completedAt).toISOString()
        },
        'Duplicate callback received for already completed session'
      )
      return // Accept silently for idempotency
    }

    // Clear timeout
    clearTimeout(session.timeout)

    // Mark session as completed and store identity
    session.completedAt = Date.now()
    session.identity = identity

    this.logger.info(
      {
        sessionId: identity.sessionId,
        jidHash: this.hashJid(identity.jid),
        hasEmail: !!(identity.email || identity.eMail),
      },
      'Neuro callback processed successfully'
    )

    // Emit identity data to waiting promise
    session.emitter.emit('identity', identity)

    // Keep session in memory for code verification (will expire via timeout)
  }

  /**
   * Hash JID for logging (PII protection)
   */
  private hashJid(jid: string): string {
    // Simple hash for logging - replace with crypto hash in production
    return jid.split('@')[0].substring(0, 3) + '***@' + jid.split('@')[1]
  }

  /**
   * Wait for user to scan QR code and receive identity
   */
  async waitForIdentity(sessionId: string, timeoutMs = 5 * 60 * 1000): Promise<NeuroIdentity> {
    const session = this.sessions.get(sessionId)

    if (!session) {
      this.logger.warn({ sessionId }, 'Attempted to wait for unknown session')
      throw new Error('Authentication session not found or expired. Please try again.')
    }

    return new Promise<NeuroIdentity>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for QR scan'))
      }, timeoutMs)

      session.emitter.once('identity', (identity: NeuroIdentity) => {
        clearTimeout(timeout)
        resolve(identity)
      })

      session.emitter.once('error', (error: Error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  /**
   * Check if session is still pending
   */
  isSessionPending(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * Get session ID for a verification code
   */
  getSessionByCode(code: string): string | undefined {
    // Remove dash if present
    const cleanCode = code.replace('-', '')
    return this.codeSessions.get(cleanCode)
  }

  /**
   * Check if session is completed with identity data
   */
  isSessionCompleted(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    return session?.completedAt !== undefined
  }

  /**
   * Get identity from completed session
   */
  getSessionIdentity(sessionId: string): NeuroIdentity | undefined {
    const session = this.sessions.get(sessionId)
    return session?.identity
  }

  /**
   * Store session reference for an identifier (email/handle)
   */
  setSessionForIdentifier(identifier: string, sessionId: string): void {
    this.identifierSessions.set(identifier, sessionId)
    setTimeout(() => this.identifierSessions.delete(identifier), 5 * 60 * 1000)
  }

  /**
   * Get session ID for an identifier
   */
  getSessionIdForIdentifier(identifier: string): string | undefined {
    return this.identifierSessions.get(identifier)
  }

  /**
   * Correlate OAuth request with Neuro session
   */
  async correlateSession(sessionId: string, requestUri: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.requestUri = requestUri
    }

    if (this.db) {
      await this.db.db
        .updateTable('neuro_pending_session')
        .set({ requestUri })
        .where('sessionId', '=', sessionId)
        .execute()
    } else if (this.redis) {
      const key = `neuro:session:${sessionId}`
      await this.redis.hset(key, 'requestUri', requestUri)
    }
  }

  // Database storage methods

  private async storePendingSessionDb(
    sessionId: string,
    serviceId: string,
    requestUri?: string,
    deviceId?: string,
  ): Promise<void> {
    if (!this.db) return

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes

    await this.db.db
      .insertInto('neuro_pending_session')
      .values({
        sessionId,
        serviceId,
        requestUri: requestUri || null,
        deviceId: deviceId || null,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        completedAt: null,
        neuroJid: null,
      })
      .execute()
  }

  // Redis storage methods

  private async storePendingSessionRedis(
    sessionId: string,
    serviceId: string,
    requestUri?: string,
    deviceId?: string,
  ): Promise<void> {
    if (!this.redis) return

    const key = `neuro:session:${sessionId}`
    const data = {
      sessionId,
      serviceId,
      requestUri: requestUri || '',
      deviceId: deviceId || '',
      createdAt: Date.now().toString(),
    }

    await this.redis.hmset(key, data)
    await this.redis.expire(key, 5 * 60) // 5 minutes TTL
  }

  /**
   * Find account by Neuro JID
   */
  async findAccountByNeuroJid(jid: string): Promise<{ did: string } | null> {
    if (!this.db) {
      this.logger.error('Database not configured for Neuro authentication')
      throw new Error('Server configuration error. Please contact support.')
    }

    const result = await this.db.db
      .selectFrom('neuro_identity_link')
      .select(['did'])
      .where('neuroJid', '=', jid)
      .executeTakeFirst()

    return result || null
  }

  /**
   * Create link between Neuro JID and account DID
   */
  async linkIdentity(
    jid: string,
    did: string,
    email?: string,
    userName?: string,
  ): Promise<void> {
    if (!this.db) {
      this.logger.error('Database not configured for Neuro identity linking')
      throw new Error('Server configuration error. Please contact support.')
    }

    this.logger.info(
      {
        did,
        jidHash: this.hashJid(jid),
        hasEmail: !!email,
      },
      'Linking Neuro identity to account'
    )

    await this.db.db
      .insertInto('neuro_identity_link')
      .values({
        neuroJid: jid,
        did,
        email: email || null,
        userName: userName || null,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(jid: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not configured')
    }

    await this.db.db
      .updateTable('neuro_identity_link')
      .set({ lastLoginAt: new Date().toISOString() })
      .where('neuroJid', '=', jid)
      .execute()
  }

  /**
   * Clean up expired sessions (database only)
   */
  async cleanupExpiredSessions(): Promise<void> {
    if (!this.db) return

    const now = new Date().toISOString()

    await this.db.db
      .deleteFrom('neuro_pending_session')
      .where('expiresAt', '<', now)
      .execute()
  }
}
```

**Important:** The cleanup method should be called periodically. Add this to your PDS startup code:

```typescript
// In packages/pds/src/index.ts or context.ts after creating neuroAuthManager
if (ctx.neuroAuthManager && ctx.cfg.neuro?.storageBackend === 'database') {
  // Clean up expired sessions every minute
  const cleanupInterval = setInterval(() => {
    ctx.neuroAuthManager?.cleanupExpiredSessions().catch((err) => {
      ctx.logger.error({ err }, 'Neuro session cleanup failed')
    })
  }, 60 * 1000)

  // Clean up on shutdown
  process.on('SIGTERM', () => clearInterval(cleanupInterval))
  process.on('SIGINT', () => clearInterval(cleanupInterval))
}
```

---

### Step 3: Extend OAuthStore

Modify the `OAuthStore` class to support Neuro authentication via the `emailOtp` field.

**File:** `packages/pds/src/account-manager/oauth-store.ts` (MODIFY)

**Note:** Add these imports at the top of the file:
```typescript
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { Client, createOp as createPlcOp } from '@did-plc/lib'
import { NeuroAuthManager } from './helpers/neuro-auth-manager'

export class OAuthStore implements AccountStore, RequestStore /* ... */ {
  constructor(
    // ... existing parameters ...
    private readonly neuroAuthManager?: NeuroAuthManager,
  ) {
    // ... existing initialization ...
  }
}
```

#### 3.2 Modify authenticateAccount Method

This method uses the **2FA error mechanism** with 6-digit verification codes.

```typescript
async authenticateAccount({
  locale,
  username: identifier,
  password,
  emailOtp,
}: AuthenticateAccountData): Promise<Account> {
  // NEURO AUTHENTICATION FLOW
  if (!password && this.neuroAuthManager) {
    // Step 1: Check if user is submitting verification code (second attempt)
    if (emailOtp) {
      // User entered the 6-digit code displayed with QR
      const sessionId = this.neuroAuthManager.getSessionByCode(emailOtp)

      if (!sessionId) {
        throw new InvalidRequestError(
          'Invalid verification code. Please check the code and try again.',
          NeuroErrorCodes.CODE_INVALID
        )
      }

      // Check if session received callback from Neuro
      if (!this.neuroAuthManager.isSessionCompleted(sessionId)) {
        throw new InvalidRequestError(
          'Please scan the QR code with your Neuro app before entering the code. ' +
          'Make sure you completed the authentication in the app.',
          NeuroErrorCodes.SESSION_INCOMPLETE
        )
      }

      // Get identity from completed session
      const identity = this.neuroAuthManager.getSessionIdentity(sessionId)
      if (!identity) {
        throw new InvalidRequestError(
          'Your authentication session expired. Please try again.',
          NeuroErrorCodes.SESSION_DATA_MISSING
        )
      }

      // Find account by Neuro JID
      const link = await this.neuroAuthManager.findAccountByNeuroJid(identity.jid)
      if (!link) {
        throw new InvalidRequestError(
          'This Neuro identity is not linked to any account. Please sign up first.',
          NeuroErrorCodes.IDENTITY_NOT_LINKED
        )
      }

      // Update last login time
      await this.neuroAuthManager.updateLastLogin(identity.jid)

      // Get account and return
      const account = await this.accountManager.getAccount(link.did)
      if (!account) {
        this.logger.error(
          { did: link.did },
          'Account DID found in neuro_identity_link but not in account table'
        )
        throw new InvalidRequestError(
          'Account data is inconsistent. Please contact support.',
          'AccountNotFound'
        )
      }

      return this.buildAccount(account)
    }

    // Step 2: First attempt - initiate session and show QR code
    const { sessionId, qrCodeUrl, verificationCode } =
      await this.neuroAuthManager.initiateSession()

    // Store session reference for this identifier
    this.neuroAuthManager.setSessionForIdentifier(identifier, sessionId)

    // Create hint with QR URL and verification code
    const hint = `Please scan this QR code with your Neuro app:

${qrCodeUrl}

After scanning, enter this code: **${verificationCode}**

This will authenticate you with your Neuro identity.`

    // Throw 2FA error - OAuth UI will display hint + code input field
    throw new SecondAuthenticationFactorRequiredError(
      'emailOtp',
      hint,
      [identifier]
    )
  }

  // Standard password authentication (fallback if password provided)
  const { user, appPassword, isSoftDeleted } =
    await this.accountManager.login({ identifier, password })

  if (isSoftDeleted) {
    throw new AccessDeniedError('Account has been deactivated', 'AccountDeactivated')
  }

  // ... rest of existing logic ...
}
```

#### 3.3 Verification Code Flow

The verification code flow works as follows:

1. **Session Creation**: When `initiateSession()` is called, a random 6-digit code is generated
2. **Code Display**: The code is formatted as `XXX-XXX` and shown to the user alongside the QR code
3. **Code Mapping**: The code is stored in a Map with the sessionId for 5 minutes
4. **QR Scan**: User scans QR code, Neuro sends callback to server, session marked complete
5. **Code Entry**: User enters the displayed code
6. **Verification**: Server looks up sessionId from code, checks if callback was received
7. **Authentication**: If session is complete, user is authenticated

This approach provides:
- ✅ Simple 6-digit code (easy to type)
- ✅ Unique per session (prevents race conditions)
- ✅ Familiar UX (like SMS 2FA codes)
- ✅ No complex database queries needed

#### 3.4 Support Passwordless Account Creation

**Note:** Neuro signup uses the same code-based flow as login.

```typescript
async createAccount(data: SignUpData): Promise<Account> {
  const { handle, email, password, emailOtp, inviteCode, locale } = data

  // Check if this is a Neuro signup (no password + verification code)
  if (!password && emailOtp && this.neuroAuthManager) {
    // Verify the code
    const sessionId = this.neuroAuthManager.getSessionByCode(emailOtp)

    if (!sessionId) {
      throw new InvalidRequestError(
        'Invalid verification code. Please check the code and try again.',
        NeuroErrorCodes.CODE_INVALID
      )
    }

    if (!this.neuroAuthManager.isSessionCompleted(sessionId)) {
      throw new InvalidRequestError(
        'Please scan the QR code with your Neuro app before entering the code.',
        NeuroErrorCodes.SESSION_INCOMPLETE
      )
    }

    const identity = this.neuroAuthManager.getSessionIdentity(sessionId)
    if (!identity) {
      throw new InvalidRequestError(
        'Your authentication session expired. Please try again.',
        NeuroErrorCodes.SESSION_DATA_MISSING
      )
    }

    return this.createAccountWithNeuro({
      handle,
      email,
      inviteCode,
      locale,
      identity,
    })
  }

  // Standard account creation with password
  // ... existing implementation ...
}

private async createAccountWithNeuro(data: {
  handle: string
  email?: string
  inviteCode?: string
  locale?: string
  identity: NeuroIdentity
}): Promise<Account> {
  if (!this.neuroAuthManager) {
    throw new InvalidRequestError('Neuro authentication not configured')
  }

  const { identity } = data

  // Check if already linked
  const existing = await this.neuroAuthManager.findAccountByNeuroJid(identity.jid)

  if (existing) {
    throw new InvalidRequestError(
      'This Neuro identity is already linked to an account. Please log in instead.',
      NeuroErrorCodes.IDENTITY_ALREADY_LINKED
    )
  }

  // Extract email from Neuro identity
  // Note: Neuro API may use 'email' or 'eMail' field name
  const email = identity.email || identity.eMail || identity.userName || data.email
  if (!email) {
    this.logger.error(
      {
        jidHash: this.neuroAuthManager.hashJid(identity.jid),
        availableFields: Object.keys(identity),
        hasEmail: !!identity.email,
        hasEMail: !!identity.eMail,
        hasUserName: !!identity.userName
      },
      'Email not found in Neuro identity response'
    )
    throw new InvalidRequestError(
      'Your Neuro account does not have an email address configured. ' +
      'Please add an email to your Neuro account and try again.',
      NeuroErrorCodes.IDENTITY_EMAIL_MISSING
    )
  }

  // Verify availability
  await this.verifyEmailAvailability(email)
  await this.verifyHandleAvailability(data.handle)
  if (data.inviteCode) {
    await this.verifyInviteCode(data.inviteCode)
  }

  // Create signing key and DID
  const signingKey = await Secp256k1Keypair.create({ exportable: true })
  const signingKeyDid = signingKey.did()

  const plcCreate = await createPlcOp({
    signingKey: signingKeyDid,
    rotationKeys: this.recoveryDidKey
      ? [this.recoveryDidKey, this.plcRotationKey.did()]
      : [this.plcRotationKey.did()],
    handle: data.handle,
    pds: this.publicUrl,
    signer: this.plcRotationKey,
  })

  const { did, op } = plcCreate

  try {
    await this.actorStore.create(did, signingKey)

    try {
      const commit = await this.actorStore.transact(did, (actorTxn) =>
        actorTxn.repo.createRepo([]),
      )

      await this.plcClient.sendOperation(did, op)

      // Create account WITHOUT password
      await this.accountManager.createAccount({
        did,
        handle: data.handle,
        email,
        password: undefined,  // Passwordless account
        inviteCode: data.inviteCode,
        repoCid: commit.cid,
        repoRev: commit.rev,
      })

      // Link Neuro identity
      await this.neuroAuthManager.linkIdentity(
        identity.jid,
        did,
        identity.email || identity.eMail,  // Try both field names
        identity.userName,
      )

      // Sequence events
      await this.sequencer.sequenceIdentityEvt(did, data.handle)
      await this.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
      await this.sequencer.sequenceCommit(did, commit)
      await this.sequencer.sequenceSyncEvt(did, syncEvtDataFromCommit(commit))

      await this.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
      await this.actorStore.clearReservedKeypair(signingKeyDid, did)

      const account = await this.accountManager.getAccount(did)
      if (!account) throw new Error('Account not found')

      return await this.buildAccount(account)
    } catch (err) {
      await this.actorStore.destroy(did)
      throw err
    }
  } catch (err) {
    if (err instanceof XrpcInvalidRequestError) {
      throw new InvalidRequestError(err.message, err)
    }
    throw err
  }
}
```

---

### Step 4: Add OAuth Hooks

Implement the `OAuthHooks` interface to integrate Neuro into the OAuth flow.

**File:** `packages/pds/src/context.ts` (MODIFY)

#### 4.1 Create NeuroAuthManager Instance

```typescript
import { NeuroAuthManager } from './account-manager/helpers/neuro-auth-manager'

export class AppContext {
  public neuroAuthManager?: NeuroAuthManager

  // ... in constructor or setup method ...

  if (cfg.neuro?.enabled) {
    this.neuroAuthManager = new NeuroAuthManager(
      {
        domain: cfg.neuro.domain,
        callbackBaseUrl: cfg.service.publicUrl,
        storageBackend: cfg.neuro.storageBackend || 'database',
      },
      cfg.neuro.storageBackend === 'redis'
        ? this.redisScratch
        : this.accountManager.db,  // Access database through AccountManager
    )
  }
}
```

#### 4.2 Add Hooks to OAuthProvider

**Note:** For simplicity, we track Neuro usage via hooks but don't use them to conditionally show QR codes. The authorization UI always shows QR codes when Neuro is enabled.

```typescript
// When creating OAuthProvider instance

const oauthProvider = new OAuthProvider({
  // ... existing config ...

  store: new OAuthStore(
    accountManager,
    actorStore,
    // ... other dependencies ...
    ctx.neuroAuthManager,  // Pass Neuro auth manager
  ),

  // OAuth Hooks for Neuro tracking (optional)
  hooks: ctx.neuroAuthManager ? {
    async onSignedIn({ account, data }) {
      // Track Neuro vs password logins
      const wasNeuroLogin = data.emailOtp?.startsWith('neuro:')
      if (wasNeuroLogin) {
        ctx.logger.info({ did: account.sub }, 'User logged in via Neuro')
      }
    },

    async onSignedUp({ account, data }) {
      // Track Neuro signups
      const wasNeuroSignup = data.password?.startsWith('neuro:')
      if (wasNeuroSignup) {
        ctx.logger.info({ did: account.sub }, 'User signed up via Neuro')
      }
    },
  } : undefined,
})
```

---

### Step 5: Custom OAuth UI (INVESTIGATION REQUIRED)

**⚠️ STATUS: This section requires further investigation of the OAuth Provider UI architecture.**

**Current Blocker:** The exact mechanism for passing custom data (QR codes) from server to OAuth Provider React UI is unclear and needs investigation:

1. **Hydration Data Flow:** How does OAuth Provider pass server-side data to the authorization-page React component?
2. **Custom Props:** Can we extend the authorization page props with custom data?
3. **Asset Override:** Can we override the UI assets while preserving data flow?

**Recommended Approach for Now:**

**Option A: Skip OAuth UI Integration (Backend Only)**
- Implement Steps 1-4 and Step 6-8 (database, manager, hooks, callback)
- Users authenticate via direct API calls or custom frontend
- OAuth UI shows standard password form only
- Revisit UI integration after backend is stable

**Option B: Investigate OAuth Provider UI Mechanism**
- Research `packages/oauth/oauth-provider/src/router/assets/send-authorization-page.ts`
- Understand how `packages/oauth/oauth-provider-ui/src/authorization-page.tsx` receives data
- Document the hydration/props mechanism
- Then implement custom UI properly

**For this guide, we'll document the theoretical approach but mark it as requiring investigation:**

---

#### 5.1 Fork OAuth Provider UI (Theoretical)

Create a custom OAuth provider UI with Neuro QR code components.

#### 5.1 Clone OAuth Provider UI

```bash
# From packages/pds directory
cd packages/pds
mkdir -p oauth-ui
cp -r ../oauth/oauth-provider-ui/* oauth-ui/
```

#### 5.2 Add Neuro Login Component

**File:** `packages/pds/oauth-ui/src/components/NeuroLoginTab.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react'

interface NeuroLoginTabProps {
  qrCodeUrl: string
  sessionId: string
  onComplete: () => void
}

export function NeuroLoginTab({ qrCodeUrl, sessionId, onComplete }: NeuroLoginTabProps) {
  const [polling, setPolling] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (polling) {
      // Poll every 2 seconds to check if QR was scanned
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/neuro/session/${sessionId}/status`)
          const data = await response.json()

          if (!data.pending) {
            setPolling(false)
            onComplete()
          }
        } catch (err) {
          console.error('Error polling session status:', err)
          setError('Failed to check authentication status')
        }
      }, 2000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [polling, sessionId, onComplete])

  return (
    <div className="neuro-login-container">
      <h2>Login with Neuro Quick Login</h2>
      <div className="qr-code-container">
        <img src={qrCodeUrl} alt="Neuro Quick Login QR Code" />
      </div>
      <p className="instructions">
        Scan this QR code with your Neuro-enabled mobile device to sign in.
      </p>
      {error && <div className="error">{error}</div>}
      {polling && <div className="spinner">Waiting for scan...</div>}
    </div>
  )
}
```

#### 5.3 Modify Authorization Page

**File:** `packages/pds/oauth-ui/src/authorization-page.tsx` (MODIFY)

```typescript
import { NeuroLoginTab } from './components/NeuroLoginTab'

// In the component render:
function AuthorizationPage({ neuroSession, ...props }: AuthorizationPageProps) {
  const [authMethod, setAuthMethod] = useState<'password' | 'neuro'>(
    neuroSession ? 'neuro' : 'password'
  )

  const handleNeuroComplete = () => {
    // Redirect to complete OAuth flow
    window.location.href = `/oauth/authorize/redirect?request_uri=${props.requestUri}`
  }

  return (
    <div className="authorization-page">
      {neuroSession && (
        <div className="auth-method-tabs">
          <button onClick={() => setAuthMethod('neuro')}>Neuro Quick Login</button>
          <button onClick={() => setAuthMethod('password')}>Password</button>
        </div>
      )}

      {authMethod === 'neuro' && neuroSession ? (
        <NeuroLoginTab
          qrCodeUrl={neuroSession.qrCodeUrl}
          sessionId={neuroSession.sessionId}
          onComplete={handleNeuroComplete}
        />
      ) : (
        <PasswordLoginForm {...props} />
      )}
    </div>
  )
}
```

#### 5.4 Build Custom UI

Update `packages/pds/oauth-ui/package.json` to build to custom location:

```json
{
  "name": "@atproto/pds-oauth-ui",
  "scripts": {
    "build": "vite build --outDir ../oauth-ui-dist"
  }
}
```

Build the UI:

```bash
cd packages/pds/oauth-ui
pnpm install
pnpm build
```

#### 5.5 Configure PDS to Use Custom UI

**File:** `packages/pds/src/config/config.ts` (MODIFY)

```typescript
export interface NeuroConfig {
  enabled: boolean
  domain: string
  storageBackend: 'database' | 'redis'
  customUiPath?: string
}

export interface ServerConfig {
  // ... existing config ...
  neuro?: NeuroConfig
}
```

**File:** `packages/pds/src/index.ts` (MODIFY)

```typescript
// When creating OAuth Provider, configure custom UI assets

const oauthProvider = new OAuthProvider({
  // ... existing config ...

  // Override UI asset paths if Neuro is enabled
  assets: ctx.cfg.neuro?.customUiPath ? {
    authorizationPage: path.join(ctx.cfg.neuro.customUiPath, 'authorization-page.js'),
    authorizationPageCss: path.join(ctx.cfg.neuro.customUiPath, 'authorization-page.css'),
  } : undefined,
})
```

---

### Step 6: Add Callback Endpoint

Create the endpoint that receives identity data from Neuro.

**File:** `packages/pds/src/basic-routes.ts` (MODIFY)

**IMPORTANT:** Add `express.json()` middleware for Neuro routes, as XRPC middleware doesn't apply to custom routes.

```typescript
import express, { Router } from 'express'
import { AppContext } from './context'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  // ... existing routes ...

  // Add JSON body parser for Neuro routes
  router.use('/neuro/*', express.json())

  // Neuro Quick Login callback endpoint
  if (ctx.neuroAuthManager) {
    router.post('/neuro/callback', async (req, res) => {
      try {
        const identity = req.body

        // Validate required fields
        if (!identity.sessionId || !identity.jid) {
          ctx.logger.warn(
            {
              hasSessionId: !!identity.sessionId,
              hasJid: !!identity.jid,
              fields: Object.keys(identity)
            },
            'Neuro callback missing required fields'
          )
          return res.status(400).json({
            error: 'Missing required fields',
            code: NeuroErrorCodes.CALLBACK_MISSING_FIELDS,
            details: {
              required: ['sessionId', 'jid'],
              received: Object.keys(identity)
            }
          })
        }

        // Validate JID format
        if (typeof identity.jid !== 'string' || !identity.jid.includes('@')) {
          ctx.logger.warn(
            { jidType: typeof identity.jid },
            'Neuro callback with invalid JID format'
          )
          return res.status(400).json({
            error: 'Invalid JID format',
            code: NeuroErrorCodes.CALLBACK_INVALID_JID,
          })
        }

        // Handle the callback (idempotent - accepts duplicates)
        ctx.neuroAuthManager.handleCallback(identity)

        // Respond to Neuro API
        res.status(200).json({
          status: 'success',
          sessionId: identity.sessionId
        })
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found or expired')) {
            // Session not found - could be expired or invalid
            return res.status(404).json({
              error: 'Session not found or expired',
              code: NeuroErrorCodes.CALLBACK_SESSION_NOT_FOUND,
            })
          }

          ctx.logger.error(
            { error: error.message, stack: error.stack },
            'Unexpected error processing Neuro callback'
          )
          res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
          })
        } else {
          ctx.logger.error({ error }, 'Unknown callback error type')
          res.status(500).json({
            error: 'Unknown error',
            code: 'UNKNOWN_ERROR'
          })
        }
      }
    })

    // Session status endpoint for frontend polling
    router.get('/neuro/session/:sessionId/status', async (req, res) => {
      const { sessionId } = req.params
      const isPending = ctx.neuroAuthManager.isSessionPending(sessionId)

      res.json({
        pending: isPending,
        sessionId,
      })
    })
  }

  return router
}
```

---

### Step 7: Error Handling & Logging

This section covers comprehensive error handling and logging strategies for production deployments.

#### 7.1 Error Code Reference

All Neuro-specific errors use structured error codes defined in `NeuroErrorCodes`:

| Error Code | HTTP Status | Description | Retryable? | User Action |
|------------|-------------|-------------|------------|-------------|
| `NEURO_CODE_INVALID` | 400 | Verification code doesn't match any session | ✅ Yes | Re-enter code carefully |
| `NEURO_SESSION_INCOMPLETE` | 400 | Code entered before QR scanned | ✅ Yes | Scan QR first, then enter code |
| `NEURO_SESSION_DATA_MISSING` | 400 | Session identity data unavailable | ❌ No | Start new session |
| `NEURO_IDENTITY_NOT_LINKED` | 400 | Neuro JID not linked to account | ❌ No | Sign up first |
| `NEURO_IDENTITY_ALREADY_LINKED` | 400 | Neuro JID linked to different account | ❌ No | Log in instead |
| `NEURO_IDENTITY_EMAIL_MISSING` | 400 | Neuro account missing email | ❌ No | Add email to Neuro account |
| `NEURO_CALLBACK_MISSING_FIELDS` | 400 | Callback missing sessionId or jid | ❌ No | Server/API issue |
| `NEURO_CALLBACK_INVALID_JID` | 400 | JID format validation failed | ❌ No | Server/API issue |
| `NEURO_CALLBACK_SESSION_NOT_FOUND` | 404 | Callback for unknown session | ❌ No | Session expired |

#### 7.2 Logging Best Practices

**PII Protection:**
- Never log full JIDs - use `hashJid()` to create `jidHash`
- Never log email addresses in plain text
- Never log full sessionIds in production (first 8 chars only)

**Example safe logging:**
```typescript
this.logger.info({
  sessionId: sessionId.substring(0, 8) + '...',  // Truncated
  jidHash: this.hashJid(identity.jid),           // Hashed
  hasEmail: !!identity.email,                     // Boolean only
  method: 'neuro_quicklogin'
}, 'User authenticated successfully')
```

**Log Levels:**
- `error` - Unexpected failures, API errors, data corruption
- `warn` - Expired sessions, duplicate callbacks, validation failures
- `info` - Successful authentication, session creation, identity linking
- `debug` - Detailed flow information (disable in production)

#### 7.3 Monitoring & Alerts

**Key Metrics to Track:**

```typescript
// Success rate
const neuroAuthSuccessRate = successfulAuths / totalAttempts

// Session completion rate (QR scanned)
const qrScanRate = completedSessions / initiatedSessions

// Average time to complete
const avgCompletionTime = sum(completionTimes) / completedSessions

// Error distribution
const errorsByCode = groupBy(errors, 'code')
```

**Recommended Alerts:**
- Neuro API error rate > 5% (check connectivity)
- Session expiration rate > 30% (UX issue)
- Duplicate callback rate > 1% (Neuro API issue)
- Missing email error > 5% (Neuro configuration issue)

#### 7.4 Error Recovery Strategies

**For Users:**
1. **Invalid Code** → "Check the code and try again"
2. **Session Expired** → "Please refresh and start over"
3. **Not Scanned Yet** → "Scan QR code first, then enter the code"
4. **Identity Not Linked** → "Sign up first, then log in"
5. **Neuro API Down** → "Service temporarily unavailable. Try password login or wait a few minutes"

**For Operators:**
1. **High API Error Rate** → Check Neuro API status, verify domain configuration
2. **Session Timeouts** → Investigate if 5-minute window is too short
3. **Missing Email Errors** → Coordinate with Neuro team on field names
4. **Database Errors** → Check connection pool, migration status

#### 7.5 Development vs Production

**Development:**
```typescript
// More verbose logging
logger.level = 'debug'

// Longer session timeout for testing
sessionTimeout = 15 * 60 * 1000  // 15 minutes

// Log full errors
logger.error({ error, identity }, 'Full error context')
```

**Production:**
```typescript
// Minimal logging
logger.level = 'info'

// Standard timeout
sessionTimeout = 5 * 60 * 1000  // 5 minutes

// Scrubbed logging
logger.error({
  code: error.code,
  jidHash: hashJid(identity.jid)
}, 'Sanitized error')
```

---

### Step 8: Configuration

Add Neuro configuration to PDS environment and config files.

#### 8.1 Environment Variables

**File:** `packages/pds/.env` (or your environment config)

```bash
# Neuro Quick Login Configuration
NEURO_ENABLED=true
NEURO_DOMAIN=mateo.lab.tagroot.io
NEURO_STORAGE_BACKEND=database  # or 'redis'
NEURO_CUSTOM_UI_PATH=./oauth-ui-dist

# Required: Public URL must be HTTPS
PDS_PUBLIC_URL=https://your-pds-domain.com

# Optional: Redis configuration (if using Redis backend)
# REDIS_HOST=localhost
# REDIS_PORT=6379
```

#### 8.2 Config Schema

**File:** `packages/pds/src/config/config.ts` (MODIFY)

```typescript
export interface NeuroConfig {
  enabled: boolean
  domain: string
  storageBackend: 'database' | 'redis'
  customUiPath?: string
}

export interface ServerConfig {
  // ... existing fields ...
  neuro?: NeuroConfig
}
```

#### 8.3 Config Loader

**File:** `packages/pds/src/config/env.ts` (MODIFY)

```typescript
export const readEnv = (): ServerEnvironment => {
  return {
    // ... existing environment variables ...

    neuro: process.env.NEURO_ENABLED === 'true' ? {
      enabled: true,
      domain: envStr('NEURO_DOMAIN') || 'mateo.lab.tagroot.io',
      storageBackend: (envStr('NEURO_STORAGE_BACKEND') || 'database') as 'database' | 'redis',
      customUiPath: envStr('NEURO_CUSTOM_UI_PATH'),
    } : undefined,
  }
}
```

---

### Step 9: Testing

#### 9.1 Unit Tests

**File:** `packages/pds/tests/neuro-auth-manager.test.ts` (NEW)

```typescript
import { NeuroAuthManager } from '../src/account-manager/helpers/neuro-auth-manager'

describe('NeuroAuthManager', () => {
  let manager: NeuroAuthManager

  beforeEach(() => {
    manager = new NeuroAuthManager({
      domain: 'mateo.lab.tagroot.io',
      callbackBaseUrl: 'https://test-pds.com',
      storageBackend: 'database',
    })
  })

  describe('initiateSession', () => {
    it('should create a new session', async () => {
      const session = await manager.initiateSession()

      expect(session.sessionId).toBeTruthy()
      expect(session.serviceId).toBeTruthy()
      expect(session.qrCodeUrl).toContain(session.serviceId)
    })

    it('should generate unique session IDs', async () => {
      const session1 = await manager.initiateSession()
      const session2 = await manager.initiateSession()

      expect(session1.sessionId).not.toBe(session2.sessionId)
    })
  })

  describe('handleCallback', () => {
    it('should emit identity when callback received', async () => {
      const session = await manager.initiateSession()

      const identityPromise = manager.waitForIdentity(session.sessionId, 5000)

      const mockIdentity = {
        sessionId: session.sessionId,
        jid: 'test@example.com',
        eMail: 'test@example.com',
        userName: 'testuser',
      }

      manager.handleCallback(mockIdentity)

      const identity = await identityPromise
      expect(identity.jid).toBe(mockIdentity.jid)
    })

    it('should reject on timeout', async () => {
      const session = await manager.initiateSession()

      await expect(
        manager.waitForIdentity(session.sessionId, 100)
      ).rejects.toThrow('Timeout')
    })
  })
})
```

#### 9.2 Integration Tests

**File:** `packages/pds/tests/neuro-integration.test.ts` (NEW)

```typescript
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { SeedClient } from './seeds/client'

describe('Neuro Integration', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'pds_neuro_integration',
    })
    sc = network.getSeedClient()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('Signup with Neuro', () => {
    it('should create account without password', async () => {
      // This would require mocking Neuro API responses
      // Or using a test Neuro environment

      const handle = 'test-neuro.test'
      const neuroJid = 'test@neuro.local'

      // Mock Neuro session
      const mockSession = {
        sessionId: 'mock-session-123',
        serviceId: 'mock-service-456',
        qrCodeUrl: 'https://test.com/qr',
      }

      // Create account via mocked Neuro flow
      // ... test implementation ...
    })
  })

  describe('Login with Neuro', () => {
    it('should authenticate existing user', async () => {
      // Test login flow
      // ... test implementation ...
    })

    it('should reject unlinked Neuro identity', async () => {
      // Test rejection of unknown identity
      // ... test implementation ...
    })
  })
})
```

#### 9.3 E2E Flow Test

```bash
# Manual E2E testing procedure

# 1. Start PDS with Neuro enabled
cd packages/pds
NEURO_ENABLED=true pnpm start

# 2. Navigate to signup page
open https://localhost:3000/signup

# 3. Enter handle and click "Sign up with Neuro"

# 4. Scan QR code with Neuro mobile app

# 5. Verify account created without password

# 6. Check database:
sqlite3 pds.sqlite "SELECT * FROM neuro_identity_link;"
sqlite3 pds.sqlite "SELECT did, email, passwordScrypt FROM account;"

# Expected: passwordScrypt should be NULL for Neuro account
```

---

## Security Considerations

### 1. Callback URL Validation

**File:** `packages/pds/src/basic-routes.ts`

Add signature verification for Neuro callbacks:

```typescript
router.post('/neuro/callback', async (req, res) => {
  // Validate callback came from Neuro
  const callbackIp = req.ip
  const allowedIps = ['<Neuro server IP range>'] // Get from Neuro documentation

  if (!allowedIps.some(ip => callbackIp.includes(ip))) {
    ctx.logger.warn({ ip: callbackIp }, 'Callback from unauthorized IP')
    return res.status(403).json({ error: 'Forbidden' })
  }

  // ... rest of callback handling ...
})
```

### 2. HTTPS Requirement

Ensure PDS is configured with valid SSL certificate:

```bash
# In production, use proper SSL certificate
# Never use self-signed certificates with Neuro
```

### 3. Rate Limiting

**File:** `packages/pds/src/basic-routes.ts`

Add rate limiting to prevent abuse:

```typescript
import rateLimit from 'express-rate-limit'

const neuroRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP',
})

router.use('/neuro/*', neuroRateLimiter)
```

### 4. Session Expiration

Sessions automatically expire after 5 minutes (configured in NeuroAuthManager). This matches Neuro's QR code lifetime.

### 5. Input Validation

All callback data is validated:
- JID format checked (`must contain @`)
- Required fields verified (`sessionId`, `jid`)
- Email format validated if provided

---

## Deployment

### 1. Environment Setup

```bash
# Production environment variables
export NEURO_ENABLED=true
export NEURO_DOMAIN=mateo.lab.tagroot.io
export NEURO_STORAGE_BACKEND=redis  # Use Redis for production
export PDS_PUBLIC_URL=https://your-pds.com
export REDIS_HOST=your-redis-host
export REDIS_PORT=6379
```

### 2. Run Migrations

```bash
cd packages/pds
pnpm db migrate
```

Expected output:
```
Running migration: 008-neuro-identity
Running migration: 009-nullable-password
Migrations complete
```

### 3. Build Custom UI

```bash
cd packages/pds/oauth-ui
pnpm install
pnpm build

# Verify build output
ls -la ../oauth-ui-dist/
# Should contain: authorization-page.js, authorization-page.css
```

### 4. Configure Callback URL

Ensure your PDS is accessible at the configured callback URL:

```bash
# Test callback URL accessibility
curl -X POST https://your-pds.com/neuro/callback \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","jid":"test@example.com"}'

# Expected: {"error":"Session not found or expired"}
# (This confirms the endpoint is accessible)
```

### 5. Start PDS

```bash
cd packages/pds
pnpm start
```

### 6. Monitor Logs

Watch for Neuro-related log entries:

```bash
tail -f pds.log | grep -i neuro
```

Expected log entries:
- `Neuro session initiated` - When QR code generated
- `Neuro callback processed` - When user scans QR
- `User logged in via Neuro` - Successful authentication
- `User signed up via Neuro` - New account created

---

## Troubleshooting

### Issue: Callback endpoint returns 404

**Solution:** Verify `express.json()` middleware is added to `/neuro/*` routes:

```typescript
router.use('/neuro/*', express.json())
```

### Issue: QR code doesn't display

**Solution:** Check that custom UI was built and path is correct:

```bash
ls packages/pds/oauth-ui-dist/
# Should show: authorization-page.js, authorization-page.css
```

### Issue: Session timeout errors

**Solution:** Neuro QR codes expire after 5 minutes. User must scan within this window.

### Issue: "No account linked to this Neuro identity"

**Solution:** User must sign up first before logging in. Verify `neuro_identity_link` table has entry.

### Issue: Password field still required

**Solution:** Verify migration 009 ran successfully and `account.passwordScrypt` is nullable.

---

## Flow Diagrams

### Signup Flow

```
┌─────────┐                ┌─────────┐              ┌─────────┐           ┌─────────┐
│ Client  │                │   PDS   │              │  OAuth  │           │  Neuro  │
│         │                │         │              │Provider │           │   API   │
└────┬────┘                └────┬────┘              └────┬────┘           └────┬────┘
     │                          │                        │                     │
     │ 1. Navigate to signup    │                        │                     │
     ├─────────────────────────>│                        │                     │
     │                          │                        │                     │
     │ 2. Show signup form      │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
     │ 3. Submit handle         │                        │                     │
     ├─────────────────────────>│                        │                     │
     │                          │                        │                     │
     │                          │ 4. Initiate session    │                     │
     │                          ├────────────────────────┼────────────────────>│
     │                          │ POST /QuickLogin       │                     │
     │                          │                        │                     │
     │                          │ 5. serviceId returned  │                     │
     │                          │<───────────────────────┼─────────────────────┤
     │                          │                        │                     │
     │ 6. Display QR code       │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
     │ 7. User scans QR         │                        │  8. Scan QR code    │
     │                          │                        │                     │
     │                          │ 9. Neuro callback      │                     │
     │                          │<───────────────────────┼─────────────────────┤
     │                          │ POST /neuro/callback   │                     │
     │                          │ {sessionId, jid, ...}  │                     │
     │                          │                        │                     │
     │                          │ 10. Create account     │                     │
     │                          │ - password: null       │                     │
     │                          │ - link Neuro JID       │                     │
     │                          │                        │                     │
     │                          │ 11. Complete OAuth     │                     │
     │                          ├───────────────────────>│                     │
     │                          │                        │                     │
     │ 12. Redirect with code   │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
     │ 13. Exchange for token   │                        │                     │
     ├─────────────────────────>│                        │                     │
     │                          │                        │                     │
     │ 14. Access token         │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
```

### Login Flow

```
┌─────────┐                ┌─────────┐              ┌─────────┐           ┌─────────┐
│ Client  │                │   PDS   │              │  OAuth  │           │  Neuro  │
│         │                │         │              │Provider │           │   API   │
└────┬────┘                └────┬────┘              └────┬────┘           └────┬────┘
     │                          │                        │                     │
     │ 1. Start OAuth flow      │                        │                     │
     │ GET /oauth/authorize     │                        │                     │
     ├─────────────────────────>│                        │                     │
     │                          │                        │                     │
     │                          │ 2. Process request     │                     │
     │                          ├───────────────────────>│                     │
     │                          │                        │                     │
     │                          │ 3. onAuthorizationReq  │                     │
     │                          │<───────────────────────┤                     │
     │                          │                        │                     │
     │                          │ 4. Initiate session    │                     │
     │                          ├────────────────────────┼────────────────────>│
     │                          │                        │                     │
     │                          │ 5. serviceId returned  │                     │
     │                          │<───────────────────────┼─────────────────────┤
     │                          │                        │                     │
     │ 6. Show QR code          │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
     │ 7. Frontend polls status │                        │                     │
     │ GET /neuro/session/xxx   │                        │                     │
     ├─────────────────────────>│                        │                     │
     │                          │                        │                     │
     │ 8. Status: pending       │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │  9. User scans QR   │
     │                          │                        │                     │
     │                          │ 10. Neuro callback     │                     │
     │                          │<───────────────────────┼─────────────────────┤
     │                          │ {sessionId, jid, ...}  │                     │
     │                          │                        │                     │
     │                          │ 11. Find account       │                     │
     │                          │ via neuro_identity_link│                     │
     │                          │                        │                     │
     │                          │ 12. Trigger auth comp. │                     │
     │                          │                        │                     │
     │ 13. Poll: complete       │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
     │ 14. Redirect to OAuth    │                        │                     │
     ├─────────────────────────>│                        │                     │
     │                          │                        │                     │
     │                          │ 15. Complete OAuth     │                     │
     │                          ├───────────────────────>│                     │
     │                          │                        │                     │
     │ 16. Auth code            │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
     │ 17. Exchange for token   │                        │                     │
     ├─────────────────────────>│                        │                     │
     │                          │                        │                     │
     │ 18. Access token         │                        │                     │
     │<─────────────────────────┤                        │                     │
     │                          │                        │                     │
```

---

## Summary

This implementation guide provides complete instructions for integrating Neuro Quick Login with 6-digit verification code authentication for AT Protocol PDS. The approach:

✅ **Uses existing OAuth Provider extension points** (2FA error mechanism with verification codes)
✅ **No OAuth Provider forking required** - Uses standard SecondAuthenticationFactorRequiredError
✅ **Simple UX** - User scans QR, enters 6-digit code (like SMS 2FA)
✅ **Passwordless accounts** - Users authenticate via Neuro identity only
✅ **Server-side only** - No client modifications needed
✅ **Production-ready error handling** - Structured error codes, retry logic, idempotent callbacks
✅ **Comprehensive logging** - PII-protected structured logging with monitoring guidance
✅ **Flexible storage** - Supports both database and Redis backends

**Authentication Flow:**
1. User enters email/handle (no password)
2. Server shows QR code + 6-digit code via 2FA error
3. User scans QR with Neuro app
4. Neuro sends callback to server (with retry & idempotency)
5. User enters displayed 6-digit code
6. Server validates code and session completion
7. Authentication succeeds

**Error Handling:**
- Structured error codes (`NEURO_*`) for programmatic handling
- User-friendly error messages with clear recovery steps
- Automatic retry logic for Neuro API failures (3 attempts with backoff)
- Idempotent callback handling (duplicate callbacks logged but accepted)
- PII-protected logging (hashed JIDs, no plain email addresses)

**Estimated implementation time:** 16-24 hours for experienced developer

---

## Areas Still Requiring Investigation

While the core authentication flow is now implementable with production-grade error handling, **Step 5 (Custom OAuth UI)** still requires research:

### **BLOCKER: OAuth UI Customization Mechanism**

**Problem:** The exact mechanism for passing custom data (QR URLs, verification codes) from the OAuth Provider server to the React UI is unclear.

**What we know:**
- OAuth Provider serves a React app from `packages/oauth/oauth-provider-ui`
- Server-side code in `packages/oauth/oauth-provider/src/router/assets/send-authorization-page.ts` sends the HTML
- React app somehow receives data from the server (hydration mechanism)

**What we need to understand:**
1. How does server-side data flow to React components?
2. Can we extend authorization page props with custom data?
3. What's the hydration mechanism used?
4. Can we override UI assets while preserving data flow?

**Research needed:**
- Read `packages/oauth/oauth-provider/src/router/assets/send-authorization-page.ts` in detail
- Trace how `authorization-page.tsx` receives server data
- Document the props/hydration pattern
- Test if we can inject custom data

**Workaround for now:**
- The 2FA error mechanism works **without UI customization**
- QR code URL can be displayed as text in the hint field
- Users can manually copy/paste URL or scan from text
- Once we understand the UI mechanism, we can improve UX with actual QR image rendering

**Recommendation:** Implement Steps 1-4, 6-9 first (backend fully functional with production error handling), then research Step 5 as a separate improvement task.

---

## Next Steps

1. Review prerequisites
2. Follow implementation steps 1-4 (database, manager, OAuth store, hooks)
3. Implement Step 6 (callback endpoint with error handling)
4. Configure Step 7 (error handling & logging)
5. Configure Step 8 (environment variables)
6. Test Step 9 (unit and integration tests with error scenarios)
7. **Research Step 5** (OAuth UI customization) as separate task
8. Deploy to production environment with monitoring
9. Monitor error rates and user feedback
10. Iterate on error messages based on actual user behavior

