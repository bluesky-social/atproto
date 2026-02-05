import { randomBytes } from 'crypto'
import EventEmitter from 'events'
import { Redis } from 'ioredis'
import { AccountDb } from '../db'

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
  email?: string // Note: Field name may vary - check Neuro API response
  eMail?: string // Alternative field name
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
  domain: string // e.g., 'mateo.lab.tagroot.io'
  callbackBaseUrl: string // e.g., 'https://your-pds.com'
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
  private db?: AccountDb
  private redis?: Redis
  private logger: Logger

  constructor(
    private readonly config: NeuroConfig,
    storageBackend?: AccountDb | Redis,
    logger?: Logger,
  ) {
    this.logger = logger || console

    // Configure storage backend
    if (
      config.storageBackend === 'database' &&
      !(storageBackend instanceof Redis)
    ) {
      this.db = storageBackend as AccountDb
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
        // Use http:// for localhost, https:// for everything else
        const protocol = this.config.domain.startsWith('localhost')
          ? 'http'
          : 'https'
        const fetchResponse = await fetch(
          `${protocol}://${this.config.domain}/QuickLogin`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              callbackUrl,
              sessionId,
            }),
          },
        )

        if (!fetchResponse.ok) {
          throw new Error(
            `Neuro API returned ${fetchResponse.status}: ${fetchResponse.statusText}`,
          )
        }

        response = await fetchResponse.json()
        break
      } catch (error) {
        lastError = error as Error
        this.logger.warn(
          {
            attempt,
            error: error instanceof Error ? error.message : String(error),
          },
          'Neuro API call failed, retrying...',
        )
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    if (!response) {
      this.logger.error(
        {
          error: lastError?.message,
          callbackUrl,
        },
        'Failed to initiate Neuro session after 3 attempts',
      )
      throw new Error(
        'Unable to connect to Neuro authentication service. Please try again later.',
      )
    }

    const { serviceId } = response

    if (!serviceId) {
      this.logger.error(
        {
          responseData: response,
        },
        'Neuro API returned invalid response',
      )
      throw new Error('Received invalid response from Neuro service')
    }

    // Create event emitter for callback notification
    const emitter = new EventEmitter()

    // Auto-expire after 5 minutes
    const timeout = setTimeout(
      () => {
        const session = this.sessions.get(sessionId)
        if (session) {
          session.emitter.emit('error', new Error('Session expired'))
          this.sessions.delete(sessionId)
        }
      },
      5 * 60 * 1000,
    )

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
      await this.storePendingSessionDb(
        sessionId,
        serviceId,
        requestUri,
        deviceId,
      )
    } else if (this.redis) {
      await this.storePendingSessionRedis(
        sessionId,
        serviceId,
        requestUri,
        deviceId,
      )
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
        {
          sessionId: identity.sessionId.substring(0, 8) + '...',
        },
        'Received callback for unknown or expired session',
      )
      throw new Error(`Session not found or expired`)
    }

    // Handle duplicate callbacks (idempotent)
    if (session.completedAt) {
      this.logger.warn(
        {
          sessionId: identity.sessionId.substring(0, 8) + '...',
          jidHash: this.hashJid(identity.jid),
        },
        'Duplicate callback received for already completed session',
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
        sessionId: identity.sessionId.substring(0, 8) + '...',
        jidHash: this.hashJid(identity.jid),
        hasEmail: !!identity.email || !!identity.eMail,
      },
      'Neuro callback processed successfully',
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
  async waitForIdentity(
    sessionId: string,
    timeoutMs = 5 * 60 * 1000,
  ): Promise<NeuroIdentity> {
    const session = this.sessions.get(sessionId)

    if (!session) {
      this.logger.warn({ sessionId }, 'Attempted to wait for unknown session')
      throw new Error(
        'Authentication session not found or expired. Please try again.',
      )
    }

    return new Promise<NeuroIdentity>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QR code scan timeout. Please try again.'))
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
      this.logger.error({}, 'Database not configured for Neuro authentication')
      throw new Error('Server configuration error. Please contact support.')
    }

    const result = await this.db.db
      .selectFrom('neuro_identity_link')
      .select('did')
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
      this.logger.error(
        {},
        'Database not configured for Neuro identity linking',
      )
      throw new Error('Server configuration error. Please contact support.')
    }

    this.logger.info(
      {
        jidHash: this.hashJid(jid),
        did,
        hasEmail: !!email,
      },
      'Linking Neuro identity to account',
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

  /**
   * Cleanup all sessions and timers (for shutdown/tests)
   */
  cleanup(): void {
    // Clear all timeouts to prevent them from firing after shutdown
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.timeout) {
        clearTimeout(session.timeout)
      }
      // Remove all listeners to prevent memory leaks
      session.emitter.removeAllListeners()
    }
    this.sessions.clear()
  }
}
