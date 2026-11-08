import * as plcLib from '@did-plc/lib'
import { type Keypair, Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import type { DidString, HandleString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../src/lexicons/index.js'

const ENTRYWAY_DID = 'did:example:entryway'
const PDS_DID = 'did:example:pds'
const STRICT_PDS_DID = 'did:example:strict-pds'

type Headers = Record<string, string>

type JwtOverrides = {
  header?: Record<string, unknown>
  payload?: Record<string, unknown>
  keypair?: Keypair
}

type Route = {
  lxm: string
  call: (target: TestPds, headers: Headers) => Promise<unknown>
}

describe('entryway service auth', () => {
  let plc: TestPlc
  let pds: TestPds
  let strictPds: TestPds
  let plainPds: TestPds
  let jwtSigningKey: Secp256k1Keypair
  let plcRotationKey: Secp256k1Keypair
  let modServiceKey: Secp256k1Keypair
  let modServiceDid: string

  // subject of the rejected requests
  let carol: DidString

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

  const entrywayToken = async (
    aud: string,
    lxm: string,
    overrides: JwtOverrides = {},
  ): Promise<string> => {
    const iat = Math.floor(Date.now() / 1000)
    return signJwt(
      { alg: 'ES256K', typ: 'JWT', ...overrides.header },
      {
        iss: ENTRYWAY_DID,
        aud,
        lxm,
        iat,
        exp: iat + 60,
        jti: randomStr(16, 'hex'),
        ...overrides.payload,
      },
      overrides.keypair ?? jwtSigningKey,
    )
  }

  const entrywayHeaders = async (
    target: TestPds,
    lxm: string,
    overrides?: JwtOverrides,
  ): Promise<Headers> => {
    const token = await entrywayToken(
      target.ctx.cfg.service.did,
      lxm,
      overrides,
    )
    return { authorization: `Bearer ${token}` }
  }

  const entrywayAccessHeaders = async (
    target: TestPds,
    sub: DidString,
  ): Promise<Headers> => {
    const iat = Math.floor(Date.now() / 1000)
    const token = await signJwt(
      { alg: 'ES256K', typ: 'at+jwt' },
      {
        scope: 'com.atproto.access',
        sub,
        aud: target.ctx.cfg.service.did,
        iat,
        exp: iat + 3600,
        jti: randomStr(16, 'hex'),
      },
      jwtSigningKey,
    )
    return { authorization: `Bearer ${token}` }
  }

  const modServiceHeaders = async (
    target: TestPds,
    lxm: string = com.atproto.admin.updateSubjectStatus.$lxm,
  ): Promise<Headers> => {
    const { headers } = await createServiceAuthHeaders({
      iss: modServiceDid,
      aud: target.ctx.cfg.service.did,
      lxm,
      keypair: modServiceKey,
    })
    return headers
  }

  // Authenticates as the entryway unless given other headers.
  const createAccount = async (
    target: TestPds,
    handle: string,
    headers?: Headers,
  ): Promise<DidString> => {
    const agent = target.getAgent()
    const {
      data: { signingKey },
    } = await agent.com.atproto.server.reserveSigningKey(
      {},
      {
        headers: await entrywayHeaders(
          target,
          com.atproto.server.reserveSigningKey.$lxm,
        ),
        encoding: 'application/json',
      },
    )
    const plcCreate = await plcLib.createOp({
      signingKey,
      rotationKeys: [plcRotationKey.did()],
      handle,
      pds: target.ctx.cfg.service.publicUrl,
      signer: plcRotationKey,
    })
    await agent.com.atproto.server.createAccount(
      { did: plcCreate.did, handle, plcOp: plcCreate.op },
      {
        headers:
          headers ??
          (await entrywayHeaders(
            target,
            com.atproto.server.createAccount.$lxm,
          )),
        encoding: 'application/json',
      },
    )
    return plcCreate.did as DidString
  }

  const deleteAccount = (target: TestPds, did: string, headers: Headers) =>
    target
      .getAgent()
      .com.atproto.admin.deleteAccount(
        { did },
        { headers, encoding: 'application/json' },
      )

  const updateAccountHandle = async (
    target: TestPds,
    did: DidString,
    handle: string,
    headers: Headers,
  ) => {
    // the entryway updates the did doc before notifying the pds
    await plc.getClient().updateHandle(did, plcRotationKey, handle)
    await target
      .getAgent()
      .com.atproto.admin.updateAccountHandle(
        { did, handle },
        { headers, encoding: 'application/json' },
      )
  }

  const updateTakedown = (
    target: TestPds,
    did: string,
    applied: boolean,
    headers: Headers,
  ) =>
    target.getAgent().com.atproto.admin.updateSubjectStatus(
      {
        subject: { $type: 'com.atproto.admin.defs#repoRef', did },
        takedown: { applied, ref: applied ? 'test-takedown' : undefined },
      },
      { headers, encoding: 'application/json' },
    )

  const getSubjectStatus = (target: TestPds, did: string, headers: Headers) =>
    target.getAgent().com.atproto.admin.getSubjectStatus({ did }, { headers })

  const reserveSigningKey = (target: TestPds, headers: Headers) =>
    target
      .getAgent()
      .com.atproto.server.reserveSigningKey(
        {},
        { headers, encoding: 'application/json' },
      )

  const takedownRef = async (target: TestPds, did: DidString) => {
    const account = await target.ctx.accountManager.getAccount(did, {
      includeTakenDown: true,
      includeDeactivated: true,
    })
    return account?.takedownRef ?? null
  }

  // calls that would be harmless if they did succeed
  const routes: Route[] = [
    {
      lxm: com.atproto.admin.deleteAccount.$lxm,
      call: (target, headers) =>
        deleteAccount(target, 'did:example:nonexistent', headers),
    },
    {
      lxm: com.atproto.admin.updateAccountHandle.$lxm,
      call: (target, headers) =>
        target
          .getAgent()
          .com.atproto.admin.updateAccountHandle(
            { did: carol, handle: 'carol.test' },
            { headers, encoding: 'application/json' },
          ),
    },
    {
      lxm: com.atproto.admin.updateSubjectStatus.$lxm,
      call: (target, headers) => updateTakedown(target, carol, false, headers),
    },
    {
      lxm: com.atproto.admin.getSubjectStatus.$lxm,
      call: (target, headers) => getSubjectStatus(target, carol, headers),
    },
    {
      lxm: com.atproto.server.reserveSigningKey.$lxm,
      call: (target, headers) => reserveSigningKey(target, headers),
    },
    {
      lxm: com.atproto.server.createAccount.$lxm,
      // without a did and plcOp, fails validation once authenticated
      call: (target, headers) =>
        target
          .getAgent()
          .com.atproto.server.createAccount(
            { handle: 'nobody.test' },
            { headers, encoding: 'application/json' },
          ),
    },
  ]

  beforeAll(async () => {
    jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    modServiceKey = await Secp256k1Keypair.create()

    plc = await TestPlc.create({})

    const modServiceOp = await plcLib.signOperation(
      {
        type: 'plc_operation',
        alsoKnownAs: [],
        verificationMethods: { atproto: modServiceKey.did() },
        rotationKeys: [modServiceKey.did()],
        services: {},
        prev: null,
      },
      modServiceKey,
    )
    modServiceDid = await plcLib.didForCreateOp(modServiceOp)
    await plc.getClient().sendOperation(modServiceDid, modServiceOp)

    const entrywayCfg = {
      entrywayUrl: 'https://entryway.invalid',
      entrywayDid: ENTRYWAY_DID,
      entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
      entrywayPlcRotationKey: plcRotationKey.did(),
    }
    const commonCfg = {
      bskyAppViewUrl: undefined,
      bskyAppViewDid: undefined,
      modServiceUrl: 'https://mod.invalid',
      modServiceDid,
      didPlcUrl: plc.url,
      inviteRequired: false,
    }

    pds = await TestPds.create({
      ...commonCfg,
      ...entrywayCfg,
      serviceDid: PDS_DID,
    })
    strictPds = await TestPds.create({
      ...commonCfg,
      ...entrywayCfg,
      serviceDid: STRICT_PDS_DID,
      entrywayRequireServiceAuth: true,
    })
    plainPds = await TestPds.create({
      ...commonCfg,
      serviceDid: 'did:example:plain-pds',
    })

    carol = await createAccount(pds, 'carol.test')
  })

  afterAll(async () => {
    await pds?.close()
    await strictPds?.close()
    await plainPds?.close()
    await plc?.close()
  })

  describe('with service auth optional', () => {
    it('accepts an entryway service JWT on reserveSigningKey.', async () => {
      const res = await reserveSigningKey(
        pds,
        await entrywayHeaders(pds, com.atproto.server.reserveSigningKey.$lxm),
      )
      expect(res.data.signingKey).toMatch(/^did:key:/)
    })

    it('accepts an unauthenticated reserveSigningKey.', async () => {
      const res = await reserveSigningKey(pds, {})
      expect(res.data.signingKey).toMatch(/^did:key:/)
    })

    it('accepts a token at the maximum lifetime.', async () => {
      const iat = Math.floor(Date.now() / 1000)
      const res = await reserveSigningKey(
        pds,
        await entrywayHeaders(pds, com.atproto.server.reserveSigningKey.$lxm, {
          payload: { iat, exp: iat + 300 },
        }),
      )
      expect(res.data.signingKey).toMatch(/^did:key:/)
    })

    it('accepts an entryway service JWT on createAccount.', async () => {
      const did = await createAccount(pds, 'create-jwt.test')
      const account = await pds.ctx.accountManager.getAccount(did)
      expect(account?.handle).toBe('create-jwt.test')
    })

    it('accepts an unauthenticated createAccount.', async () => {
      const did = await createAccount(pds, 'create-unauthed.test', {})
      const account = await pds.ctx.accountManager.getAccount(did)
      expect(account?.handle).toBe('create-unauthed.test')
    })

    it('accepts an entryway service JWT on deleteAccount.', async () => {
      const did = await createAccount(pds, 'delete-jwt.test')
      await deleteAccount(
        pds,
        did,
        await entrywayHeaders(pds, com.atproto.admin.deleteAccount.$lxm),
      )
      await expect(pds.ctx.accountManager.getAccount(did)).resolves.toBeNull()
    })

    it('accepts the admin password on deleteAccount.', async () => {
      const did = await createAccount(pds, 'delete-basic.test')
      await deleteAccount(pds, did, pds.adminAuthHeaders())
      await expect(pds.ctx.accountManager.getAccount(did)).resolves.toBeNull()
    })

    it('accepts an entryway service JWT on updateAccountHandle.', async () => {
      const did = await createAccount(pds, 'handle-jwt.test')
      await updateAccountHandle(
        pds,
        did,
        'handle-jwt2.test',
        await entrywayHeaders(pds, com.atproto.admin.updateAccountHandle.$lxm),
      )
      const account = await pds.ctx.accountManager.getAccount(did)
      expect(account?.handle).toBe('handle-jwt2.test')
    })

    it('accepts the admin password on updateAccountHandle.', async () => {
      const did = await createAccount(pds, 'handle-basic.test')
      await updateAccountHandle(
        pds,
        did,
        'handle-basic2.test',
        pds.adminAuthHeaders(),
      )
      const account = await pds.ctx.accountManager.getAccount(did)
      expect(account?.handle).toBe('handle-basic2.test')
    })

    it('accepts an entryway service JWT on updateSubjectStatus.', async () => {
      const did = await createAccount(pds, 'status-jwt.test')
      await updateTakedown(
        pds,
        did,
        true,
        await entrywayHeaders(pds, com.atproto.admin.updateSubjectStatus.$lxm),
      )
      await expect(takedownRef(pds, did)).resolves.toBe('test-takedown')
    })

    it('accepts the admin password on updateSubjectStatus.', async () => {
      const did = await createAccount(pds, 'status-basic.test')
      await updateTakedown(pds, did, true, pds.adminAuthHeaders())
      await expect(takedownRef(pds, did)).resolves.toBe('test-takedown')
    })

    it('accepts the mod service on updateSubjectStatus.', async () => {
      const did = await createAccount(pds, 'status-mod.test')
      await updateTakedown(pds, did, true, await modServiceHeaders(pds))
      await expect(takedownRef(pds, did)).resolves.toBe('test-takedown')
    })

    it('accepts an entryway service JWT on getSubjectStatus.', async () => {
      const res = await getSubjectStatus(
        pds,
        carol,
        await entrywayHeaders(pds, com.atproto.admin.getSubjectStatus.$lxm),
      )
      expect(res.data.subject).toMatchObject({ did: carol })
    })

    it('accepts the admin password on getSubjectStatus.', async () => {
      const res = await getSubjectStatus(pds, carol, pds.adminAuthHeaders())
      expect(res.data.subject).toMatchObject({ did: carol })
    })

    it('accepts the mod service on getSubjectStatus.', async () => {
      const res = await getSubjectStatus(
        pds,
        carol,
        await modServiceHeaders(pds, com.atproto.admin.getSubjectStatus.$lxm),
      )
      expect(res.data.subject).toMatchObject({ did: carol })
    })
  })

  describe('rejections', () => {
    const rejections: {
      name: string
      overrides: (route: Route) => JwtOverrides
      message: string
    }[] = [
      {
        name: 'a wrong iss',
        overrides: () => ({ payload: { iss: 'did:example:not-entryway' } }),
        message: 'Untrusted issuer',
      },
      {
        name: 'a wrong aud',
        overrides: () => ({ payload: { aud: STRICT_PDS_DID } }),
        message: 'jwt audience does not match service did',
      },
      {
        name: 'a missing lxm',
        overrides: () => ({ payload: { lxm: undefined } }),
        message: 'missing jwt lexicon method',
      },
      {
        name: "another route's lxm",
        overrides: (route) => ({
          payload: {
            lxm: routes[(routes.indexOf(route) + 1) % routes.length].lxm,
          },
        }),
        message: 'bad jwt lexicon method',
      },
      {
        name: 'an expired token',
        overrides: () => {
          const now = Math.floor(Date.now() / 1000)
          return { payload: { iat: now - 120, exp: now - 60 } }
        },
        message: 'jwt expired',
      },
      {
        name: 'a token living longer than 5 minutes',
        overrides: () => {
          const now = Math.floor(Date.now() / 1000)
          return { payload: { iat: now, exp: now + 301 } }
        },
        message: 'jwt lifetime is too long',
      },
      {
        name: 'a token issued in the future',
        overrides: () => {
          const now = Math.floor(Date.now() / 1000)
          return { payload: { iat: now + 3600, exp: now + 3660 } }
        },
        message: 'jwt iat is missing or invalid',
      },
      {
        name: 'a missing iat',
        overrides: () => ({ payload: { iat: undefined } }),
        message: 'jwt iat is missing or invalid',
      },
      {
        name: 'typ at+jwt',
        overrides: () => ({ header: { typ: 'at+jwt' } }),
        message: 'Invalid jwt type "at+jwt"',
      },
      {
        name: 'a missing typ',
        overrides: () => ({ header: { typ: undefined } }),
        message: 'Invalid jwt type',
      },
      {
        name: 'an empty alg',
        overrides: () => ({ header: { alg: '' } }),
        message: 'Invalid jwt algorithm',
      },
      {
        name: 'a bad signature',
        overrides: () => ({ keypair: modServiceKey }),
        message: 'jwt signature does not match jwt issuer',
      },
    ]

    describe.each(routes)('on $lxm', (route) => {
      it.each(rejections)('rejects $name.', async ({ overrides, message }) => {
        const headers = await entrywayHeaders(pds, route.lxm, overrides(route))
        await expect(route.call(pds, headers)).rejects.toThrow(message)
      })

      it('rejects an entryway access token.', async () => {
        const headers = await entrywayAccessHeaders(pds, carol)
        await expect(route.call(pds, headers)).rejects.toThrow(
          'Invalid jwt type "at+jwt"',
        )
      })
    })

    it.each([
      {
        name: 'a wrong aud',
        handle: 'create-wrong-aud.test' as HandleString,
        payload: { aud: 'did:example:another-pds' },
      },
      {
        name: "another method's lxm",
        handle: 'create-wrong-lxm.test' as HandleString,
        payload: { lxm: com.atproto.server.reserveSigningKey.$lxm },
      },
    ])(
      'refuses an otherwise valid createAccount with $name.',
      async ({ handle, payload }) => {
        for (const target of [pds, strictPds]) {
          const headers = await entrywayHeaders(
            target,
            com.atproto.server.createAccount.$lxm,
            { payload },
          )
          await expect(
            createAccount(target, handle, headers),
          ).rejects.toMatchObject({ status: 401 })
          await expect(
            target.ctx.accountManager.getAccount(handle),
          ).resolves.toBeNull()
        }
      },
    )
  })

  describe('access tokens', () => {
    it('accepts an entryway access token as an access token.', async () => {
      const res = await pds
        .getAgent()
        .com.atproto.server.checkAccountStatus(undefined, {
          headers: await entrywayAccessHeaders(pds, carol),
        })
      expect(res.data.activated).toBe(true)
    })

    it('refuses an entryway service JWT as an access token.', async () => {
      const attempt = pds
        .getAgent()
        .com.atproto.server.checkAccountStatus(undefined, {
          headers: await entrywayHeaders(
            pds,
            com.atproto.server.checkAccountStatus.$lxm,
            { payload: { sub: carol } },
          ),
        })
      await expect(attempt).rejects.toThrow('Token could not be verified')
    })
  })

  describe('with service auth required', () => {
    let dave: DidString

    beforeAll(async () => {
      dave = await createAccount(strictPds, 'dave.test')
    })

    it('refuses an unauthenticated reserveSigningKey.', async () => {
      await expect(reserveSigningKey(strictPds, {})).rejects.toThrow(
        'Entryway service auth required',
      )
    })

    // until the entryway signs createAccount
    it('still accepts an unauthenticated createAccount.', async () => {
      const did = await createAccount(strictPds, 'strict-unauthed.test', {})
      const account = await strictPds.ctx.accountManager.getAccount(did)
      expect(account?.handle).toBe('strict-unauthed.test')
    })

    it('refuses the admin password on createAccount.', async () => {
      await expect(
        createAccount(
          strictPds,
          'strict-basic.test',
          strictPds.adminAuthHeaders(),
        ),
      ).rejects.toMatchObject({
        status: 401,
        message: 'Invalid authorization header',
      })
      await expect(
        strictPds.ctx.accountManager.getAccount('strict-basic.test'),
      ).resolves.toBeNull()
    })

    it('accepts an entryway service JWT on createAccount.', async () => {
      const did = await createAccount(strictPds, 'strict-create.test')
      const account = await strictPds.ctx.accountManager.getAccount(did)
      expect(account?.handle).toBe('strict-create.test')
    })

    it('accepts an entryway service JWT on reserveSigningKey.', async () => {
      const res = await reserveSigningKey(
        strictPds,
        await entrywayHeaders(
          strictPds,
          com.atproto.server.reserveSigningKey.$lxm,
        ),
      )
      expect(res.data.signingKey).toMatch(/^did:key:/)
    })

    it('refuses the admin password on deleteAccount.', async () => {
      await expect(
        deleteAccount(strictPds, dave, strictPds.adminAuthHeaders()),
      ).rejects.toThrow('Entryway service auth required')
      await expect(
        strictPds.ctx.accountManager.getAccount(dave),
      ).resolves.not.toBeNull()
    })

    it('refuses an unauthenticated deleteAccount.', async () => {
      await expect(deleteAccount(strictPds, dave, {})).rejects.toThrow(
        'Entryway service auth required',
      )
    })

    it('accepts an entryway service JWT on deleteAccount.', async () => {
      const did = await createAccount(strictPds, 'strict-delete.test')
      await deleteAccount(
        strictPds,
        did,
        await entrywayHeaders(strictPds, com.atproto.admin.deleteAccount.$lxm),
      )
      await expect(
        strictPds.ctx.accountManager.getAccount(did),
      ).resolves.toBeNull()
    })

    it('refuses the admin password on updateAccountHandle.', async () => {
      await expect(
        updateAccountHandle(
          strictPds,
          dave,
          'dave-basic.test',
          strictPds.adminAuthHeaders(),
        ),
      ).rejects.toThrow('Entryway service auth required')
      const account = await strictPds.ctx.accountManager.getAccount(dave)
      expect(account?.handle).toBe('dave.test')
    })

    it('accepts an entryway service JWT on updateAccountHandle.', async () => {
      await updateAccountHandle(
        strictPds,
        dave,
        'dave2.test',
        await entrywayHeaders(
          strictPds,
          com.atproto.admin.updateAccountHandle.$lxm,
        ),
      )
      const account = await strictPds.ctx.accountManager.getAccount(dave)
      expect(account?.handle).toBe('dave2.test')
    })

    it('refuses the admin password on updateSubjectStatus.', async () => {
      await expect(
        updateTakedown(strictPds, dave, true, strictPds.adminAuthHeaders()),
      ).rejects.toThrow('Entryway service auth required')
      await expect(takedownRef(strictPds, dave)).resolves.toBeNull()
    })

    it('accepts the mod service on updateSubjectStatus.', async () => {
      await updateTakedown(
        strictPds,
        dave,
        true,
        await modServiceHeaders(strictPds),
      )
      await expect(takedownRef(strictPds, dave)).resolves.toBe('test-takedown')
    })

    it('accepts an entryway service JWT on updateSubjectStatus.', async () => {
      await updateTakedown(
        strictPds,
        dave,
        false,
        await entrywayHeaders(
          strictPds,
          com.atproto.admin.updateSubjectStatus.$lxm,
        ),
      )
      await expect(takedownRef(strictPds, dave)).resolves.toBeNull()
    })

    it('refuses the admin password on getSubjectStatus.', async () => {
      await expect(
        getSubjectStatus(strictPds, dave, strictPds.adminAuthHeaders()),
      ).rejects.toThrow('Entryway service auth required')
    })

    it('accepts an entryway service JWT on getSubjectStatus.', async () => {
      const res = await getSubjectStatus(
        strictPds,
        dave,
        await entrywayHeaders(
          strictPds,
          com.atproto.admin.getSubjectStatus.$lxm,
        ),
      )
      expect(res.data.subject).toMatchObject({ did: dave })
    })
  })

  describe('without entryway configuration', () => {
    it('ignores authorization on reserveSigningKey.', async () => {
      const res = await reserveSigningKey(
        plainPds,
        await entrywayHeaders(
          plainPds,
          com.atproto.server.reserveSigningKey.$lxm,
          { keypair: modServiceKey },
        ),
      )
      expect(res.data.signingKey).toMatch(/^did:key:/)
    })

    it('creates an account without authentication.', async () => {
      const res = await plainPds.getAgent().com.atproto.server.createAccount({
        handle: 'plain.test',
        email: 'plain@test.com',
        password: 'hunter22',
      })
      expect(res.data.handle).toBe('plain.test')
    })

    it('creates an account for the DID of user service auth.', async () => {
      const key = await Secp256k1Keypair.create()
      const op = await plcLib.signOperation(
        {
          type: 'plc_operation',
          alsoKnownAs: [],
          verificationMethods: { atproto: key.did() },
          rotationKeys: [key.did()],
          services: {},
          prev: null,
        },
        key,
      )
      const did = await plcLib.didForCreateOp(op)
      await plc.getClient().sendOperation(did, op)
      const { headers } = await createServiceAuthHeaders({
        iss: did,
        aud: plainPds.ctx.cfg.service.did,
        lxm: com.atproto.server.createAccount.$lxm,
        keypair: key,
      })
      const res = await plainPds.getAgent().com.atproto.server.createAccount(
        {
          did: did as DidString,
          handle: 'plain-migrated.test',
          email: 'plain-migrated@test.com',
          password: 'hunter22',
        },
        { headers, encoding: 'application/json' },
      )
      expect(res.data.did).toBe(did)
    })

    it('does not accept entryway service JWTs.', async () => {
      await expect(
        deleteAccount(
          plainPds,
          'did:example:nonexistent',
          await entrywayHeaders(plainPds, com.atproto.admin.deleteAccount.$lxm),
        ),
      ).rejects.toThrow('Authentication Required')
    })
  })
})
