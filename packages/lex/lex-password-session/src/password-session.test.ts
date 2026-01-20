/* eslint-disable @typescript-eslint/no-namespace */

import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest'
import { Client, XrpcResponseError } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'
import { LexRouter, LexServerAuthError } from '@atproto/lex-server'
import { Server, serve } from '@atproto/lex-server/nodejs'
import { LexAuthFactorError } from './error.js'
import { com } from './lexicons/index.js'
import { AuthVerifier } from './password-session-utils.test.js'
import {
  PasswordSession,
  PasswordSessionOptions,
  SessionData,
} from './password-session.js'

const defaultOptions: Partial<PasswordSessionOptions> = {
  onUpdateFailure: async (session, cause) => {
    throw new Error('Should not fail to refresh session', { cause })
  },
  onDeleteFailure: async (session, cause) => {
    throw new Error('Should not fail to delete session', { cause })
  },
}

// Example app lexicon
namespace app {
  export namespace example {
    export namespace customMethod {
      export const main = l.procedure(
        'app.example.customMethod',
        l.params(),
        l.jsonPayload({ message: l.string() }),
        l.jsonPayload({
          message: l.string(),
          did: l.string({ format: 'did' }),
        }),
      )
    }

    export namespace expiredToken {
      export const main = l.query(
        'app.example.expiredToken',
        l.params(),
        l.payload(),
      )
    }
  }
}

describe(PasswordSession, () => {
  let entrywayServer: Server
  let entrywayOrigin: string

  let pdsServer: Server
  let pdsOrigin: string

  beforeAll(async () => {
    const authVerifier = new AuthVerifier()

    const entrywayRouter = new LexRouter()
      .add(com.atproto.server.createSession, async ({ input }) => {
        const session = await authVerifier.create(input.body)

        const body: com.atproto.server.createSession.OutputBody = {
          accessJwt: session.accessJwt,
          refreshJwt: session.refreshJwt,

          did: session.did,
          didDoc: {
            '@context': 'https://w3.org/ns/did/v1',
            id: session.did,
            service: [
              {
                id: `${session.did}#atproto_pds`,
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: pdsUrl,
              },
            ],
          },
          handle: session.handle,
        }

        return { body }
      })
      .add(com.atproto.server.getSession, {
        auth: authVerifier.accessStrategy,
        handler: async ({ credentials: { session } }) => {
          const body: com.atproto.server.getSession.OutputBody = {
            did: session.did,
            didDoc: {
              '@context': 'https://w3.org/ns/did/v1',
              id: session.did,
              service: [
                {
                  id: `${session.did}#atproto_pds`,
                  type: 'AtprotoPersonalDataServer',
                  serviceEndpoint: pdsOrigin,
                },
              ],
            },
            handle: session.handle,
            email: session.email,
            emailConfirmed: true,
            emailAuthFactor: false,
            active: true,
            status: 'active',
          }

          return { body }
        },
      })
      .add(com.atproto.server.refreshSession, {
        auth: authVerifier.refreshStrategy,
        handler: async ({ credentials: { session } }) => {
          await session.rotate()

          // Note, we omit email and didDoc here to test that they are properly
          // fetched via getSession in the agent
          const body: com.atproto.server.refreshSession.OutputBody = {
            accessJwt: session.accessJwt,
            refreshJwt: session.refreshJwt,

            did: session.did,
            didDoc: undefined,
            handle: session.handle,

            email: undefined,
            emailConfirmed: undefined,
          }

          return { body }
        },
      })
      .add(com.atproto.server.deleteSession, {
        auth: authVerifier.refreshStrategy,
        handler: async ({ credentials: { session } }) => {
          await session.destroy()
          return {}
        },
      })

    entrywayServer = await serve(entrywayRouter)
    const { port } = entrywayServer.address() as { port: number }
    entrywayOrigin = `http://localhost:${port}`

    const pdsRouter = new LexRouter()
      .add(app.example.customMethod, {
        auth: authVerifier.accessStrategy,
        handler: async ({ input, credentials: { session } }) => {
          return { body: { message: input.body.message, did: session.did } }
        },
      })
      .add(app.example.expiredToken, async () => {
        throw new LexServerAuthError('ExpiredToken', 'Token expired')
      })

    pdsServer = await serve(pdsRouter)
    const { port: pdsPort } = pdsServer.address() as { port: number }
    pdsOrigin = `http://localhost:${pdsPort}`
    const pdsUrl = pdsOrigin
  })

  afterAll(async () => {
    entrywayServer.close()
    pdsServer.close()
  })

  it('fails with invalid credentials', async () => {
    const onDeleted: PasswordSessionOptions['onDeleted'] = vi.fn()
    const onUpdated: PasswordSessionOptions['onUpdated'] = vi.fn()

    await expect(
      PasswordSession.create({
        ...defaultOptions,
        service: entrywayOrigin,
        identifier: 'alice',
        password: 'wrong-password',
        onDeleted,
        onUpdated,
      }),
    ).rejects.toMatchObject({
      success: false,
      status: 401,
      error: 'AuthenticationRequired',
    })

    expect(onDeleted).not.toHaveBeenCalled()
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('requires 2fa', async () => {
    const onDeleted: PasswordSessionOptions['onDeleted'] = vi.fn()
    const onUpdated: PasswordSessionOptions['onUpdated'] = vi.fn()

    const result = await PasswordSession.create({
      ...defaultOptions,
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      onDeleted,
      onUpdated,
    }).then(
      () => {
        throw new Error('Expected to fail')
      },
      (err: unknown) => err,
    )

    assert(result instanceof LexAuthFactorError)
    expect(result.error).toBe('AuthFactorTokenRequired')
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('logs in', async () => {
    const onDeleted: PasswordSessionOptions['onDeleted'] = vi.fn()
    const onUpdated: PasswordSessionOptions['onUpdated'] = vi.fn()

    const session = await PasswordSession.create({
      ...defaultOptions,
      service: entrywayOrigin,
      identifier: 'alice',
      password: 'password123',
      authFactorToken: '2fa-token',
      onDeleted,
      onUpdated,
    })

    expect(onUpdated).toHaveBeenCalledTimes(1)

    const client = new Client(session)

    await expect(
      client.call(app.example.customMethod, { message: 'hello' }),
    ).resolves.toMatchObject({
      message: 'hello',
      did: 'did:example:alice',
    })

    await expect(
      client.call(app.example.customMethod, { message: 'world' }),
    ).resolves.toMatchObject({
      message: 'world',
      did: 'did:example:alice',
    })

    expect(onDeleted).not.toHaveBeenCalled()

    await session.logout()

    expect(onDeleted).toHaveBeenCalled()

    await expect(
      client.call(app.example.customMethod, { message: 'hello' }),
    ).rejects.toThrow('Logged out')
  })

  it('fails to perform unauthenticated call', async () => {
    const client = new Client(pdsOrigin)
    const result = await client.xrpcSafe(app.example.customMethod, {
      body: { message: 'hello' },
    })

    assert(result.success === false)
    assert(result instanceof XrpcResponseError)
    expect(result).toMatchObject({
      success: false,
      status: 401,
      error: 'AuthenticationRequired',
    })
    expect(result.headers.get('www-authenticate')).toBe(
      'Bearer realm="access token"',
    )
  })

  it('refreshes expired token', async () => {
    const onDeleted: PasswordSessionOptions['onDeleted'] = vi.fn()
    const onUpdated: PasswordSessionOptions['onUpdated'] = vi.fn()

    const session = await PasswordSession.create({
      ...defaultOptions,
      service: entrywayOrigin,
      identifier: 'bob',
      password: 'password123',
      authFactorToken: '2fa-token',
      onUpdated,
      onDeleted,
    })

    const client = new Client(session)

    await expect(
      client.call(app.example.customMethod, { message: 'before' }),
    ).resolves.toMatchObject({
      message: 'before',
      did: 'did:example:bob',
    })

    expect(onUpdated).toHaveBeenCalledTimes(1)

    await expect(client.call(app.example.expiredToken)).rejects.toThrow(
      'Token expired',
    )

    expect(onUpdated).toHaveBeenCalledTimes(2)
    expect(onUpdated).toHaveBeenLastCalledWith(
      expect.objectContaining({
        service: entrywayOrigin,

        accessJwt: expect.any(String),
        refreshJwt: expect.any(String),

        email: expect.stringContaining('@'),
        emailConfirmed: true,
        emailAuthFactor: false,
        handle: 'bob.example',
        did: 'did:example:bob',
        didDoc: expect.objectContaining({ id: 'did:example:bob' }),
      }),
    )

    await expect(
      client.call(app.example.customMethod, { message: 'after' }),
    ).resolves.toMatchObject({
      message: 'after',
      did: 'did:example:bob',
    })
  })

  it('restores session from storage', async () => {
    const onDeleted: PasswordSessionOptions['onDeleted'] = vi.fn()
    const onUpdated: PasswordSessionOptions['onUpdated'] = vi.fn()

    const initialAgent = await PasswordSession.create({
      ...defaultOptions,
      service: entrywayOrigin,
      identifier: 'carla',
      password: 'password123',
      authFactorToken: '2fa-token',
      onUpdated,
      onDeleted,
    })

    expect(initialAgent.did).toEqual('did:example:carla')
    expect(onDeleted).toHaveBeenCalledTimes(0)
    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        accessJwt: expect.any(String),
        refreshJwt: expect.any(String),
      }),
    )

    const sessionData = initialAgent.session

    const resumedAgent = await PasswordSession.resume(sessionData, {
      ...defaultOptions,
      onUpdated,
      onDeleted,
    })

    expect(resumedAgent.did).toEqual('did:example:carla')
    expect(onDeleted).toHaveBeenCalledTimes(0)
    expect(onUpdated).toHaveBeenCalledTimes(2)

    // The initial session was refreshed. The data it contains is now invalid.
    await expect(initialAgent.refresh()).rejects.toMatchObject({
      success: false,
      error: 'ExpiredToken',
      status: 401,
    })

    expect(onDeleted).toHaveBeenCalledTimes(1)

    const client = new Client(resumedAgent)
    await expect(
      client.call(app.example.customMethod, { message: 'resume' }),
    ).resolves.toMatchObject({
      message: 'resume',
      did: 'did:example:carla',
    })

    expect(onDeleted).toHaveBeenCalledTimes(1)
    expect(onUpdated).toHaveBeenCalledTimes(2)

    await resumedAgent.logout()

    expect(onDeleted).toHaveBeenCalledTimes(2)
    expect(onUpdated).toHaveBeenCalledTimes(2)
  })

  it('silently ignores expected logout errors', async () => {
    let sessionData: SessionData | null = null

    const session = await PasswordSession.create({
      ...defaultOptions,
      service: entrywayOrigin,
      identifier: 'dave',
      password: 'password123',
      authFactorToken: '2fa-token',
      onUpdated: (data) => {
        sessionData = structuredClone(data)
      },
      onDeleted: () => {},
    })

    assert(sessionData)

    await session.logout()
    await session.logout()

    await PasswordSession.delete(sessionData)
    await PasswordSession.delete(sessionData)
  })
})
