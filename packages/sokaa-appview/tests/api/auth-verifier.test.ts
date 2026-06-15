import express from 'express'
import { Secp256k1Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { createServiceJwt } from '@atproto/xrpc-server'
import { AuthVerifier } from '../../src/auth-verifier'
import { ServerConfig } from '../../src/config'

describe('AuthVerifier', () => {
  const ownDid = 'did:web:sokaa.appview'
  const altDid = 'did:web:sokaa.appview.alt'
  let keypair: Secp256k1Keypair
  let idResolver: IdResolver
  let authVerifier: AuthVerifier

  beforeAll(async () => {
    keypair = await Secp256k1Keypair.create()
    idResolver = {
      did: {
        resolveAtprotoKey: jest.fn(async () => keypair.did()),
      },
    } as unknown as IdResolver
    authVerifier = new AuthVerifier(idResolver, {
      ownDid,
      alternateAudienceDids: [altDid],
      adminPasswords: ['secret'],
    })
  })

  const reqWithJwt = async (opts: {
    iss: string
    aud: string
    lxm: string
  }) => {
    const token = await createServiceJwt({
      iss: opts.iss,
      aud: opts.aud,
      keypair,
      lxm: opts.lxm,
    })
    const req = {
      method: 'GET',
      originalUrl: `/xrpc/${opts.lxm}`,
      url: `/xrpc/${opts.lxm}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as unknown as express.Request
    return { req }
  }

  it('accepts valid aud and lxm', async () => {
    const lxm = 'app.sokaa.feed.getTimeline'
    const { req } = await reqWithJwt({
      iss: 'did:plc:alice',
      aud: ownDid,
      lxm,
    })
    const result = await authVerifier.standard({ req })
    expect(result.credentials.iss).toBe('did:plc:alice')
    expect(result.credentials.aud).toBe(ownDid)
    expect(idResolver.did.resolveAtprotoKey).toHaveBeenCalled()
  })

  it('accepts alternate audience dids', async () => {
    const lxm = 'app.sokaa.feed.getTimeline'
    const { req } = await reqWithJwt({
      iss: 'did:plc:alice',
      aud: altDid,
      lxm,
    })
    const result = await authVerifier.standard({ req })
    expect(result.credentials.aud).toBe(altDid)
  })

  it('rejects wrong audience', async () => {
    const lxm = 'app.sokaa.feed.getTimeline'
    const { req } = await reqWithJwt({
      iss: 'did:plc:alice',
      aud: 'did:web:wrong',
      lxm,
    })
    await expect(authVerifier.standard({ req })).rejects.toMatchObject({
      type: 401,
    })
  })

  it('rejects wrong lxm', async () => {
    const token = await createServiceJwt({
      iss: 'did:plc:alice',
      aud: ownDid,
      keypair,
      lxm: 'app.sokaa.feed.getAuthorFeed',
    })
    const req = {
      method: 'GET',
      originalUrl: '/xrpc/app.sokaa.feed.getTimeline',
      url: '/xrpc/app.sokaa.feed.getTimeline',
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as unknown as express.Request
    await expect(authVerifier.standard({ req })).rejects.toMatchObject({
      type: 401,
    })
  })

  it('rejects untrusted issuer when iss allowlist is set', async () => {
    const lxm = 'app.sokaa.feed.getTimeline'
    const { req } = await reqWithJwt({
      iss: 'did:plc:alice',
      aud: ownDid,
      lxm,
    })
    await expect(
      authVerifier.verifyServiceJwt(
        { req },
        { iss: ['did:plc:other'], aud: null },
      ),
    ).rejects.toMatchObject({ type: 401 })
  })

  it('retries key resolution after signature failure', async () => {
    const wrongKeypair = await Secp256k1Keypair.create()
    const resolveAtprotoKey = jest.fn(
      async (_did: string, forceRefresh?: boolean) => {
        if (forceRefresh) {
          return keypair.did()
        }
        return wrongKeypair.did()
      },
    )
    const retryVerifier = new AuthVerifier(
      { did: { resolveAtprotoKey } } as unknown as IdResolver,
      {
        ownDid,
        alternateAudienceDids: [altDid],
        adminPasswords: ['secret'],
      },
    )

    const lxm = 'app.sokaa.feed.getTimeline'
    const { req } = await reqWithJwt({
      iss: 'did:plc:alice',
      aud: ownDid,
      lxm,
    })
    const result = await retryVerifier.standard({ req })
    expect(result.credentials.iss).toBe('did:plc:alice')
    expect(resolveAtprotoKey).toHaveBeenCalledTimes(2)
    expect(resolveAtprotoKey).toHaveBeenNthCalledWith(1, 'did:plc:alice', false)
    expect(resolveAtprotoKey).toHaveBeenNthCalledWith(2, 'did:plc:alice', true)
  })

  it('parseCreds returns includeTakedowns for admin basic auth', () => {
    const creds = authVerifier.parseCreds({
      credentials: { type: 'role', admin: true },
    })
    expect(creds.viewer).toBeNull()
    expect(creds.includeTakedowns).toBe(true)
  })
})

describe('ServerConfig', () => {
  it('exposes config values', () => {
    const cfg = new ServerConfig({
      serverDid: 'did:web:test',
      alternateAudienceDids: [],
      dataplaneUrl: 'http://localhost:3001',
      didPlcUrl: 'http://localhost:2582',
      adminPasswords: [],
      port: 4000,
    })
    expect(cfg.serverDid).toBe('did:web:test')
    expect(cfg.dataplaneUrl).toBe('http://localhost:3001')
    expect(cfg.port).toBe(4000)
  })
})
