import { randomBytes, randomUUID } from 'node:crypto'

export type QuickLoginSession = {
  sessionId: string
  sessionToken: string
  serviceId: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  expiresAt: string
  allowCreate: boolean
  result?: QuickLoginResult
  error?: string
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
    })

    return { sessionId, sessionToken, expiresAt }
  }

  getSession(sessionId: string): QuickLoginSession | undefined {
    return this.sessions.get(sessionId)
  }

  getSessionByServiceId(serviceId: string): QuickLoginSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.serviceId === serviceId) {
        return session
      }
    }
    return undefined
  }

  updateSessionKey(sessionId: string, signKey: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.serviceId = signKey // Update to use signKey for lookup
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
