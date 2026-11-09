import * as plcLib from '@did-plc/lib'
import { type Keypair, Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import { com } from '../src/lexicons/index.js'
import { canonicalIp } from '../src/util/ip.js'

const ENTRYWAY_DID = 'did:example:entryway'
const GLOBAL_LIMIT = 3000

type Headers = Record<string, string>

type JwtOverrides = {
  header?: Record<string, unknown>
  payload?: Record<string, unknown>
  keypair?: Keypair
}

describe('entryway relay attribution', () => {
  let plc: TestPlc
  let pds: TestPds
  let bypassIpPds: TestPds
  let plainPds: TestPds
  let jwtSigningKey: Secp256k1Keypair
  let otherKey: Secp256k1Keypair
  let plcRotationKey: Secp256k1Keypair

  const signJwt = async (
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
    keypair: Keypair,
  ): Promise<string> => {
    const b64 = (obj: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url')
    const toSign = `${b64(header)}.${b64(payload)}`
    const sig = await keypair.sign(Buffer.from(toSign, 'utf8'))
    return `${toSign}.${Buffer.from(sig).toString('base64url')}`
  }

  const relayToken = async (
    target: TestPds,
    clientIp: string,
    overrides: JwtOverrides = {},
  ): Promise<string> => {
    const iat = Math.floor(Date.now() / 1000)
    return signJwt(
      { alg: 'ES256K', typ: 'JWT', ...overrides.header },
      {
        iss: ENTRYWAY_DID,
        aud: target.ctx.cfg.service.did,
        client_ip: clientIp,
        iat,
        exp: iat + 60,
        ...overrides.payload,
      },
      overrides.keypair ?? jwtSigningKey,
    )
  }

  const relayHeaders = async (
    target: TestPds,
    clientIp: string,
    overrides?: JwtOverrides,
  ): Promise<Headers> => ({
    'x-entryway-relay': await relayToken(target, clientIp, overrides),
  })

  const serviceHeaders = async (
    target: TestPds,
    lxm: string,
    overrides: JwtOverrides = {},
  ): Promise<Headers> => {
    const iat = Math.floor(Date.now() / 1000)
    const token = await signJwt(
      { alg: 'ES256K', typ: 'JWT', ...overrides.header },
      {
        iss: ENTRYWAY_DID,
        aud: target.ctx.cfg.service.did,
        lxm,
        iat,
        exp: iat + 60,
        jti: randomStr(16, 'hex'),
        ...overrides.payload,
      },
      overrides.keypair ?? jwtSigningKey,
    )
    return { authorization: `Bearer ${token}` }
  }

  // Requests go to 127.0.0.1 so that unrelayed ones always share one bucket.
  const call = async (
    target: TestPds,
    nsid: string,
    headers: Headers,
    init: RequestInit = {},
  ) => {
    const url = new URL(`/xrpc/${nsid}`, `http://127.0.0.1:${target.port}`)
    const res = await fetch(url, { ...init, headers: { ...headers } })
    const remaining = res.headers.get('ratelimit-remaining')
    return {
      status: res.status,
      remaining: remaining === null ? null : Number(remaining),
    }
  }

  // describeServer has no limit of its own, so the headers report the global
  // per-IP bucket.
  const describeServer = (target: TestPds, headers: Headers = {}) =>
    call(target, com.atproto.server.describeServer.$lxm, headers)

  const reserveSigningKey = (target: TestPds, headers: Headers) =>
    call(
      target,
      com.atproto.server.reserveSigningKey.$lxm,
      { ...headers, 'content-type': 'application/json' },
      { method: 'POST', body: '{}' },
    )

  // Reports RateLimit-Limit rather than -Remaining: createAccount has a limit
  // of its own, which the header shows when it is the tighter one.
  const createAccount = async (
    target: TestPds,
    headers: Headers,
    body: Record<string, unknown>,
  ) => {
    const url = new URL(
      `/xrpc/${com.atproto.server.createAccount.$lxm}`,
      `http://127.0.0.1:${target.port}`,
    )
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, limit: res.headers.get('ratelimit-limit') }
  }

  beforeAll(async () => {
    jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    otherKey = await Secp256k1Keypair.create()
    plcRotationKey = await Secp256k1Keypair.create()

    plc = await TestPlc.create({})

    const entrywayCfg = {
      entrywayUrl: 'https://entryway.invalid',
      entrywayDid: ENTRYWAY_DID,
      entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
      entrywayPlcRotationKey: plcRotationKey.did(),
    }
    const commonCfg = {
      bskyAppViewUrl: undefined,
      bskyAppViewDid: undefined,
      didPlcUrl: plc.url,
      rateLimitsEnabled: true,
    }

    pds = await TestPds.create({
      ...commonCfg,
      ...entrywayCfg,
      serviceDid: 'did:example:pds',
    })
    bypassIpPds = await TestPds.create({
      ...commonCfg,
      ...entrywayCfg,
      serviceDid: 'did:example:bypass-ip-pds',
      rateLimitBypassIps: ['127.0.0.1', '::ffff:127.0.0.1', '::1'],
    })
    plainPds = await TestPds.create({
      ...commonCfg,
      serviceDid: 'did:example:plain-pds',
    })
  })

  afterAll(async () => {
    await pds?.close()
    await bypassIpPds?.close()
    await plainPds?.close()
    await plc?.close()
  })

  describe('relay tokens', () => {
    it('key rate limits by the relayed client_ip.', async () => {
      const a = await relayHeaders(pds, '198.51.100.1')
      const b = await relayHeaders(pds, '198.51.100.2')

      await expect(describeServer(pds, a)).resolves.toEqual({
        status: 200,
        remaining: GLOBAL_LIMIT - 1,
      })
      // the entryway reuses a token for a client for a while
      await expect(describeServer(pds, a)).resolves.toEqual({
        status: 200,
        remaining: GLOBAL_LIMIT - 2,
      })
      // same client, fresh token
      await expect(
        describeServer(pds, await relayHeaders(pds, '198.51.100.1')),
      ).resolves.toEqual({ status: 200, remaining: GLOBAL_LIMIT - 3 })
      await expect(describeServer(pds, b)).resolves.toEqual({
        status: 200,
        remaining: GLOBAL_LIMIT - 1,
      })
      // unrelayed requests count against the caller's own address
      await describeServer(pds)
      await expect(describeServer(pds, a)).resolves.toEqual({
        status: 200,
        remaining: GLOBAL_LIMIT - 4,
      })
    })

    it('accept IPv6 client addresses.', async () => {
      const headers = await relayHeaders(pds, '2001:db8::1')
      await expect(describeServer(pds, headers)).resolves.toEqual({
        status: 200,
        remaining: GLOBAL_LIMIT - 1,
      })
    })

    it('share one bucket across spellings of an address.', async () => {
      const spellings = [
        ['2001:db8::a:1', '2001:DB8::A:1', '2001:db8:0:0:0:0:a:1'],
        ['fe80::b:1', 'fe80::b:1%eth0', 'FE80:0::B:1%1'],
        ['198.51.100.80', '::ffff:198.51.100.80', '::FFFF:c633:6450'],
      ]
      for (const group of spellings) {
        for (const [i, clientIp] of group.entries()) {
          await expect(
            describeServer(pds, await relayHeaders(pds, clientIp)),
          ).resolves.toEqual({ status: 200, remaining: GLOBAL_LIMIT - 1 - i })
        }
      }
    })

    it('accept a token at the maximum lifetime.', async () => {
      const iat = Math.floor(Date.now() / 1000)
      const headers = await relayHeaders(pds, '198.51.100.3', {
        payload: { iat, exp: iat + 120 },
      })
      await expect(describeServer(pds, headers)).resolves.toEqual({
        status: 200,
        remaining: GLOBAL_LIMIT - 1,
      })
    })

    it('apply to methods the PDS proxies.', async () => {
      const nsid = 'com.example.unknownMethod'
      const headers = await relayHeaders(pds, '198.51.100.4')
      const first = await call(pds, nsid, headers)
      const second = await call(pds, nsid, headers)
      expect(first.remaining).toBe(GLOBAL_LIMIT - 1)
      expect(second.remaining).toBe(GLOBAL_LIMIT - 2)
    })

    const invalid: {
      name: string
      reason: string
      token: () => Promise<string>
    }[] = [
      {
        name: 'a wrong iss',
        reason: 'wrong_iss',
        token: () =>
          relayToken(pds, '198.51.100.10', {
            payload: { iss: 'did:example:not-entryway' },
          }),
      },
      {
        name: 'a wrong aud',
        reason: 'wrong_aud',
        token: () =>
          relayToken(pds, '198.51.100.11', {
            payload: { aud: bypassIpPds.ctx.cfg.service.did },
          }),
      },
      {
        name: 'an array aud',
        reason: 'wrong_aud',
        token: () =>
          relayToken(pds, '198.51.100.12', {
            payload: { aud: [pds.ctx.cfg.service.did] },
          }),
      },
      {
        name: 'an expired token',
        reason: 'expired',
        token: () => {
          const now = Math.floor(Date.now() / 1000)
          return relayToken(pds, '198.51.100.13', {
            payload: { iat: now - 120, exp: now - 60 },
          })
        },
      },
      {
        name: 'a token living longer than 120 seconds',
        reason: 'bad_lifetime',
        token: () => {
          const now = Math.floor(Date.now() / 1000)
          return relayToken(pds, '198.51.100.14', {
            payload: { iat: now, exp: now + 121 },
          })
        },
      },
      {
        name: 'a missing exp',
        reason: 'bad_lifetime',
        token: () =>
          relayToken(pds, '198.51.100.15', { payload: { exp: undefined } }),
      },
      {
        name: 'a missing iat',
        reason: 'bad_iat',
        token: () =>
          relayToken(pds, '198.51.100.16', { payload: { iat: undefined } }),
      },
      {
        name: 'a token issued in the future',
        reason: 'bad_iat',
        token: () => {
          const now = Math.floor(Date.now() / 1000)
          return relayToken(pds, '198.51.100.17', {
            payload: { iat: now + 3600, exp: now + 3660 },
          })
        },
      },
      {
        name: 'an lxm',
        reason: 'has_lxm',
        token: () =>
          relayToken(pds, '198.51.100.18', {
            payload: { lxm: com.atproto.server.describeServer.$lxm },
          }),
      },
      {
        name: 'typ at+jwt',
        reason: 'bad_typ',
        token: () =>
          relayToken(pds, '198.51.100.19', { header: { typ: 'at+jwt' } }),
      },
      {
        name: 'a missing typ',
        reason: 'bad_typ',
        token: () =>
          relayToken(pds, '198.51.100.20', { header: { typ: undefined } }),
      },
      {
        name: 'alg ES256',
        reason: 'bad_alg',
        token: () =>
          relayToken(pds, '198.51.100.21', { header: { alg: 'ES256' } }),
      },
      {
        name: 'a bad signature',
        reason: 'bad_sig',
        token: () => relayToken(pds, '198.51.100.22', { keypair: otherKey }),
      },
      {
        name: 'a client_ip that is not an IP address',
        reason: 'bad_client_ip',
        token: () => relayToken(pds, 'not-an-ip'),
      },
      {
        name: 'a malformed IPv4 client_ip',
        reason: 'bad_client_ip',
        token: () => relayToken(pds, '198.51.100.256'),
      },
      {
        name: 'an IPv4 client_ip with a zone ID',
        reason: 'bad_client_ip',
        token: () => relayToken(pds, '198.51.100.24%eth0'),
      },
      {
        name: 'a client_ip with a port',
        reason: 'bad_client_ip',
        token: () => relayToken(pds, '[2001:db8::24]:443'),
      },
      {
        name: 'a client_ip with surrounding space',
        reason: 'bad_client_ip',
        token: () => relayToken(pds, ' 198.51.100.25'),
      },
      {
        name: 'a missing client_ip',
        reason: 'bad_client_ip',
        token: () =>
          relayToken(pds, '198.51.100.23', {
            payload: { client_ip: undefined },
          }),
      },
      {
        name: 'a service JWT',
        reason: 'has_lxm',
        token: async () =>
          (
            await serviceHeaders(pds, com.atproto.server.describeServer.$lxm)
          ).authorization.slice('Bearer '.length),
      },
      {
        name: 'a malformed token',
        reason: 'malformed',
        token: async () => 'not.a.jwt',
      },
    ]

    it.each(invalid)('ignore $name.', async ({ token }) => {
      const before = await describeServer(pds)
      const res = await describeServer(pds, {
        'x-entryway-relay': await token(),
      })
      expect(res).toEqual({ status: 200, remaining: before.remaining! - 1 })
    })

    it.each(invalid)('refuse $name as $reason.', async ({ token, reason }) => {
      await expect(
        pds.ctx.authVerifier.verifyEntrywayRelayToken(await token()),
      ).rejects.toMatchObject({ reason })
    })

    it('leave authorization to the route.', async () => {
      const relay = await relayHeaders(pds, '198.51.100.30')
      const service = await serviceHeaders(
        pds,
        com.atproto.server.reserveSigningKey.$lxm,
      )
      await expect(
        reserveSigningKey(pds, { ...relay, authorization: 'Bearer bad' }),
      ).resolves.toMatchObject({ status: 401 })
      await expect(
        reserveSigningKey(pds, { ...relay, ...service }),
      ).resolves.toEqual({ status: 200, remaining: null })
    })
  })

  describe('entryway service JWTs', () => {
    it('bypass rate limits.', async () => {
      const headers = await serviceHeaders(
        pds,
        com.atproto.server.reserveSigningKey.$lxm,
      )
      await expect(reserveSigningKey(pds, headers)).resolves.toEqual({
        status: 200,
        remaining: null,
      })
    })

    it('bypass the rate limit of createAccount.', async () => {
      const {
        data: { signingKey },
      } = await pds.getAgent().com.atproto.server.reserveSigningKey(
        {},
        {
          headers: await serviceHeaders(
            pds,
            com.atproto.server.reserveSigningKey.$lxm,
          ),
          encoding: 'application/json',
        },
      )
      const handle = 'rate-limited.test'
      const plcCreate = await plcLib.createOp({
        signingKey,
        rotationKeys: [plcRotationKey.did()],
        handle,
        pds: pds.ctx.cfg.service.publicUrl,
        signer: plcRotationKey,
      })
      const headers = await serviceHeaders(
        pds,
        com.atproto.server.createAccount.$lxm,
      )
      await expect(
        createAccount(pds, headers, {
          did: plcCreate.did,
          handle,
          plcOp: plcCreate.op,
        }),
      ).resolves.toEqual({ status: 200, limit: null })
    })

    it('leave unauthenticated createAccount to its own rate limit.', async () => {
      // fails validation, after the rate limits apply
      await expect(
        createAccount(pds, {}, { handle: 'nobody.test' }),
      ).resolves.toEqual({ status: 400, limit: '100' })
    })

    it('bypass rate limits on routes that do not authenticate.', async () => {
      const headers = await serviceHeaders(
        pds,
        com.atproto.server.describeServer.$lxm,
      )
      await expect(describeServer(pds, headers)).resolves.toEqual({
        status: 200,
        remaining: null,
      })
    })

    const invalid: {
      name: string
      overrides: () => JwtOverrides
      lxm?: string
    }[] = [
      { name: 'a bad signature', overrides: () => ({ keypair: otherKey }) },
      {
        name: 'a wrong iss',
        overrides: () => ({ payload: { iss: 'did:example:not-entryway' } }),
      },
      {
        name: 'a wrong aud',
        overrides: () => ({ payload: { aud: 'did:example:plain-pds' } }),
      },
      {
        name: "another method's lxm",
        overrides: () => ({}),
        lxm: com.atproto.server.reserveSigningKey.$lxm,
      },
      {
        name: 'a token living longer than 5 minutes',
        overrides: () => {
          const now = Math.floor(Date.now() / 1000)
          return { payload: { iat: now, exp: now + 301 } }
        },
      },
    ]

    it.each(invalid)(
      'do not bypass rate limits with $name.',
      async ({ overrides, lxm }) => {
        const headers = await serviceHeaders(
          pds,
          lxm ?? com.atproto.server.describeServer.$lxm,
          overrides(),
        )
        const res = await describeServer(pds, headers)
        expect(res.status).toBe(200)
        expect(res.remaining).toEqual(expect.any(Number))
      },
    )

    it('do not bypass rate limits as a relay token.', async () => {
      const token = await relayToken(pds, '198.51.100.40')
      const res = await describeServer(pds, {
        authorization: `Bearer ${token}`,
      })
      expect(res.status).toBe(200)
      expect(res.remaining).toEqual(expect.any(Number))
    })
  })

  describe('with rate limit bypass IPs', () => {
    it('still bypasses rate limits for those IPs.', async () => {
      await expect(describeServer(bypassIpPds)).resolves.toEqual({
        status: 200,
        remaining: null,
      })
    })

    it('limits relayed requests by their client_ip.', async () => {
      const headers = await relayHeaders(bypassIpPds, '198.51.100.50')
      await expect(describeServer(bypassIpPds, headers)).resolves.toEqual({
        status: 200,
        remaining: GLOBAL_LIMIT - 1,
      })
    })
  })

  describe('without entryway configuration', () => {
    it('ignores relay tokens.', async () => {
      const before = await describeServer(plainPds)
      const res = await describeServer(
        plainPds,
        await relayHeaders(plainPds, '198.51.100.60'),
      )
      expect(res).toEqual({ status: 200, remaining: before.remaining! - 1 })
    })

    it('does not bypass rate limits for entryway service JWTs.', async () => {
      const res = await describeServer(
        plainPds,
        await serviceHeaders(plainPds, com.atproto.server.describeServer.$lxm),
      )
      expect(res.status).toBe(200)
      expect(res.remaining).toEqual(expect.any(Number))
    })
  })
})

describe('canonicalIp', () => {
  it.each([
    ['198.51.100.1', '198.51.100.1'],
    ['2001:db8::1', '2001:db8::1'],
    ['2001:DB8::1', '2001:db8::1'],
    ['2001:0db8:0000:0000:0000:0000:0000:0001', '2001:db8::1'],
    ['2001:db8:0:0:1:0:0:1', '2001:db8::1:0:0:1'],
    ['2001:db8:0:1:1:1:1:1', '2001:db8:0:1:1:1:1:1'],
    ['fe80::1%eth0', 'fe80::1'],
    ['::ffff:198.51.100.1', '198.51.100.1'],
    ['::ffff:c633:6401', '198.51.100.1'],
    ['0:0:0:0:0:ffff:0:0', '0.0.0.0'],
    ['::ffff:0:c633:6401', '::ffff:0:c633:6401'],
    ['::198.51.100.1', '::c633:6401'],
    ['::1', '::1'],
    ['::', '::'],
  ])('canonicalizes %s as %s.', (ip, expected) => {
    expect(canonicalIp(ip)).toBe(expected)
  })

  it.each([
    '',
    'not-an-ip',
    '198.51.100.256',
    '198.051.100.1',
    '198.51.100.1%eth0',
    'fe80::1%',
    '[2001:db8::1]',
    '2001:db8::1/64',
    ' 198.51.100.1',
  ])('refuses %j.', (ip) => {
    expect(canonicalIp(ip)).toBeNull()
  })
})
