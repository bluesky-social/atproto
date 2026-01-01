/* eslint-disable @typescript-eslint/no-namespace */

import { describe, expect, it } from 'vitest'
import { DidString, HandleString } from '@atproto/lex-schema'
import { LexServerAuthError } from '@atproto/lex-server'

const randomString = () =>
  Math.random().toString(36).substring(2, 10) +
  Math.random().toString(36).substring(2, 10)

export class Session {
  active = true
  accessJwt = randomString()
  refreshJwt = randomString()
  constructor(readonly identifier: string) {}
  get did(): DidString {
    return `did:example:${this.identifier}`
  }
  get handle(): HandleString {
    return `${this.identifier}.example`
  }
  get email(): string {
    return `${this.identifier}@example.com`
  }
  rotate() {
    this.accessJwt = randomString()
    this.refreshJwt = randomString()
    return this
  }
  destroy() {
    this.active = false
  }
}

describe('Session', () => {
  it('generates DID and handle from identifier', async () => {
    const session = new Session('alice')
    expect(session.did).toBe('did:example:alice')
    expect(session.handle).toBe('alice.example')
  })

  it('rotates tokens', async () => {
    const session = new Session('alice')
    const oldAccess = session.accessJwt
    const oldRefresh = session.refreshJwt
    session.rotate()
    expect(session.accessJwt).not.toBe(oldAccess)
    expect(session.refreshJwt).not.toBe(oldRefresh)
  })

  it('destroys session', async () => {
    const session = new Session('alice')
    expect(session.active).toBe(true)
    session.destroy()
    expect(session.active).toBe(false)
  })
})

export class AuthVerifier {
  sessions: Session[] = []

  async create(credentials: {
    identifier: string
    password: string
    authFactorToken?: string
  }) {
    if (!credentials.identifier || credentials.password !== 'password123') {
      throw new LexServerAuthError(
        'AuthenticationRequired',
        'Invalid identifier',
      )
    }
    if (credentials.authFactorToken !== '2fa-token') {
      throw new LexServerAuthError(
        'AuthFactorTokenRequired',
        '2FA token is required',
      )
    }
    const session = new Session(credentials.identifier)
    this.sessions.push(session)
    return session
  }

  async findBy(predicate: (s: Session) => boolean) {
    return this.sessions.find((s) => s.active && predicate(s))
  }

  accessStrategy = async ({ request }: { request: Request }) => {
    const auth = request.headers.get('authorization')
    const token = auth?.startsWith('Bearer ') && auth.slice(7)
    const session = await this.findBy((s) => s.accessJwt === token)
    if (!session) {
      throw new LexServerAuthError('AuthenticationRequired', 'Invalid token', {
        Bearer: { realm: 'access token' },
      })
    }
    return { session }
  }

  refreshStrategy = async ({ request }: { request: Request }) => {
    const auth = request.headers.get('authorization')
    const token = auth?.startsWith('Bearer ') && auth.slice(7)
    const session = await this.findBy((s) => s.refreshJwt === token)
    if (!session) {
      throw new LexServerAuthError('ExpiredToken', 'Invalid token', {
        Bearer: { realm: 'refresh token' },
      })
    }
    return { session }
  }
}

describe('AuthVerifier', () => {
  it('creates session with valid credentials', async () => {
    const verifier = new AuthVerifier()
    const session = await verifier.create({
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
    })
    expect(session.identifier).toBe('alice')
  })

  it('rejects invalid credentials', async () => {
    const verifier = new AuthVerifier()
    await expect(
      verifier.create({
        identifier: 'alice',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      error: 'AuthenticationRequired',
    })
  })

  it('rejects missing 2fa token', async () => {
    const verifier = new AuthVerifier()
    await expect(
      verifier.create({
        identifier: 'alice',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      error: 'AuthFactorTokenRequired',
    })
  })

  it('finds session by access token', async () => {
    const verifier = new AuthVerifier()
    const session = await verifier.create({
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
    })
    const found = await verifier.accessStrategy({
      request: new Request('http://example.com', {
        headers: { authorization: `Bearer ${session.accessJwt}` },
      }),
    })
    expect(found.session).toBe(session)
  })

  it('finds session by refresh token', async () => {
    const verifier = new AuthVerifier()
    const session = await verifier.create({
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
    })
    const found = await verifier.refreshStrategy({
      request: new Request('http://example.com', {
        headers: { authorization: `Bearer ${session.refreshJwt}` },
      }),
    })
    expect(found.session).toBe(session)
  })
})
