import { randomBytes, randomUUID } from 'node:crypto'

export type QuickLoginSession = {
  sessionId: string
  sessionToken: string
  serviceId: string
  callbackKey?: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  expiresAt: string
  allowCreate: boolean
  result?: QuickLoginResult
  error?: string
  // Approval mode fields (set for non-login sessions)
  purpose?: 'login' | 'delete_account' | 'plc_operation'
  approvalDid?: string // DID of the account being approved
  approvalToken?: string // email-style token created after QR scan
  debugNeuro?: QuickLoginDebugInfo
}

export type QuickLoginDebugInfo = {
  callbackPayload: Record<string, unknown>
  receivedFieldNames: string[]
  unexpectedFieldNames: string[]
}

export type QuickLoginResult = {
  accessJwt: string
  refreshJwt: string
  did: string
  handle: string
  created: boolean
}

export class QuickLoginSessionStore {
  private sessions = new Map<string, QuickLoginSession>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup()
      },
      5 * 60 * 1000,
    )
  }

  createSession(
    allowCreate: boolean,
    serviceId: string,
    purpose: QuickLoginSession['purpose'] = 'login',
    approvalDid?: string,
  ): {
    sessionId: string
    sessionToken: string
    expiresAt: string
  } {
    const sessionId = randomUUID()
    const sessionToken = randomBytes(24).toString('hex') // 48 chars
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    this.sessions.set(sessionId, {
      sessionId,
      sessionToken,
      serviceId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt,
      allowCreate,
      purpose: purpose ?? 'login',
      approvalDid,
    })

    return { sessionId, sessionToken, expiresAt }
  }

  getSession(sessionId: string): QuickLoginSession | undefined {
    return this.sessions.get(sessionId)
  }

  getSessionByServiceId(serviceId: string): QuickLoginSession | undefined {
    for (const session of this.sessions.values()) {
      if (
        session.serviceId === serviceId ||
        session.callbackKey === serviceId
      ) {
        return session
      }
    }
    return undefined
  }

  updateSessionKey(sessionId: string, signKey: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.callbackKey = signKey // Store signKey for callback lookup
    }
  }

  updateSession(
    sessionId: string,
    updates: Partial<Omit<QuickLoginSession, 'sessionId'>>,
  ): void {
    const existing = this.sessions.get(sessionId)
    if (existing) {
      this.sessions.set(sessionId, { ...existing, ...updates })
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [id, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt).getTime() < now) {
        this.sessions.delete(id)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.sessions.clear()
  }
}
