import crypto, { KeyObject } from 'node:crypto'
import express from 'express'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'
import * as ui8 from 'uint8arrays'
import { SECP256K1_JWT_ALG, parseDidKey } from '@atproto/crypto'
import {
  AuthRequiredError,
  VerifySignatureWithKeyFn,
  cryptoVerifySignatureWithKey,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import {
  Code,
  DataPlaneClient,
  getKeyAsDidKey,
  isDataplaneError,
  unpackIdentityKeys,
} from './data-plane'
import { GetIdentityByDidResponse } from './proto/bsky_pb'

type ReqCtx = {
  req: express.Request
}

type StandardAuthOpts = {
  skipAudCheck?: boolean
  lxmCheck?: (method?: string) => boolean
}

export enum RoleStatus {
  Valid,
  Invalid,
  Missing,
}

type NullOutput = {
  credentials: {
    type: 'none'
    iss: null
  }
}

type StandardOutput = {
  credentials: {
    type: 'standard'
    aud: string
    iss: string
  }
}

type RoleOutput = {
  credentials: {
    type: 'role'
    admin: boolean
  }
}

type ModServiceOutput = {
  credentials: {
    type: 'mod_service'
    aud: string
    iss: string
  }
}

const ALLOWED_AUTH_SCOPES = new Set([
  'com.atproto.access',
  'com.atproto.appPass',
  'com.atproto.appPassPrivileged',
])

export type AuthVerifierOpts = {
  ownDid: string
  alternateAudienceDids: string[]
  modServiceDid: string
  adminPasses: string[]
  entrywayJwtPublicKey?: KeyObject
}

export class AuthVerifier {
  public ownDid: string
  public standardAudienceDids: Set<string>
  public modServiceDid: string
  private adminPasses: Set<string>
  private entrywayJwtPublicKey?: KeyObject

  constructor(
    public dataplane: DataPlaneClient,
    opts: AuthVerifierOpts,
  ) {
    this.ownDid = opts.ownDid
    this.standardAudienceDids = new Set([
      opts.ownDid,
      ...opts.alternateAudienceDids,
    ])
    this.modServiceDid = opts.modServiceDid
    this.adminPasses = new Set(opts.adminPasses)
    this.entrywayJwtPublicKey = opts.entrywayJwtPublicKey
  }

  // verifiers (arrow fns to preserve scope)
  standardOptionalParameterized =
    (opts: StandardAuthOpts) =>
    async (ctx: ReqCtx): Promise<StandardOutput | NullOutput> => {
      // @TODO remove! basic auth + did supported just for testing.
      if (isBasicToken(ctx.req)) {
        const aud = this.ownDid
        const iss = ctx.req.headers['appview-as-did']
        if (typeof iss !== 'string' || !iss.startsWith('did:')) {
          throw new AuthRequiredError('bad issuer')
        }
        if (!this.parseRoleCreds(ctx.req).admin) {
          throw new AuthRequiredError('bad credentials')
        }
        return {
          credentials: { type: 'standard', iss, aud },
        }
      } else if (isBearerToken(ctx.req)) {
        // @NOTE temporarily accept entryway session tokens to shed load from PDS instances
        const token = bearerTokenFromReq(ctx.req)
        const header = token ? jose.decodeProtectedHeader(token) : undefined
        if (header?.typ === 'at+jwt') {
          // we should never use entryway session tokens in the case of flexible auth audiences (namely in the case of getFeed)
          if (opts.skipAudCheck) {
            throw new AuthRequiredError('Malformed token', 'InvalidToken')
          }
          return this.entrywaySession(ctx)
        }

        const { iss, aud } = await this.verifyServiceJwt(ctx, {
          lxmCheck: opts.lxmCheck,
          iss: null,
          aud: null,
        })
        if (!opts.skipAudCheck && !this.standardAudienceDids.has(aud)) {
          throw new AuthRequiredError(
            'jwt audience does not match service did',
            'BadJwtAudience',
          )
        }
        return {
          credentials: {
            type: 'standard',
            iss,
            aud,
          },
        }
      } else {
        return this.nullCreds()
      }
    }

  standardOptional: (ctx: ReqCtx) => Promise<StandardOutput | NullOutput> =
    this.standardOptionalParameterized({})

  standard = async (ctx: ReqCtx): Promise<StandardOutput> => {
    const output = await this.standardOptional(ctx)
    if (output.credentials.type === 'none') {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    return output as StandardOutput
  }

  role = (ctx: ReqCtx): RoleOutput => {
    const creds = this.parseRoleCreds(ctx.req)
    if (creds.status !== RoleStatus.Valid) {
      throw new AuthRequiredError()
    }
    return {
      credentials: {
        ...creds,
        type: 'role',
      },
    }
  }

  standardOrRole = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | RoleOutput> => {
    if (isBearerToken(ctx.req)) {
      return this.standard(ctx)
    } else {
      return this.role(ctx)
    }
  }

  optionalStandardOrRole = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | RoleOutput | NullOutput> => {
    if (isBearerToken(ctx.req)) {
      return await this.standard(ctx)
    } else {
      const creds = this.parseRoleCreds(ctx.req)
      if (creds.status === RoleStatus.Valid) {
        return {
          credentials: {
            ...creds,
            type: 'role',
          },
        }
      } else if (creds.status === RoleStatus.Missing) {
        return this.nullCreds()
      } else {
        throw new AuthRequiredError()
      }
    }
  }

  // @NOTE this auth verifier method is not recommended to be implemented by most appviews
  // this is a short term fix to remove proxy load from Bluesky's PDS and in line with possible
  // future plans to have the client talk directly with the appview
  entrywaySession = async (reqCtx: ReqCtx): Promise<StandardOutput> => {
    const token = bearerTokenFromReq(reqCtx.req)
    if (!token) {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }

    // if entryway jwt key not configured then do not parsed these tokens
    if (!this.entrywayJwtPublicKey) {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    }

    const res = await jose
      .jwtVerify(token, this.entrywayJwtPublicKey)
      .catch((err) => {
        if (err?.['code'] === 'ERR_JWT_EXPIRED') {
          throw new AuthRequiredError('Token has expired', 'ExpiredToken')
        }
        throw new AuthRequiredError(
          'Token could not be verified',
          'InvalidToken',
        )
      })

    const { sub, aud, scope } = res.payload
    if (typeof sub !== 'string' || !sub.startsWith('did:')) {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    } else if (
      typeof aud !== 'string' ||
      !aud.startsWith('did:web:') ||
      !aud.endsWith('.bsky.network')
    ) {
      throw new AuthRequiredError('Bad token aud', 'InvalidToken')
    } else if (typeof scope !== 'string' || !ALLOWED_AUTH_SCOPES.has(scope)) {
      throw new AuthRequiredError('Bad token scope', 'InvalidToken')
    }

    return {
      credentials: {
        type: 'standard',
        aud: this.ownDid,
        iss: sub,
      },
    }
  }

  modService = async (reqCtx: ReqCtx): Promise<ModServiceOutput> => {
    const { iss, aud } = await this.verifyServiceJwt(reqCtx, {
      aud: this.ownDid,
      iss: [this.modServiceDid, `${this.modServiceDid}#atproto_labeler`],
    })
    return { credentials: { type: 'mod_service', aud, iss } }
  }

  roleOrModService = async (
    reqCtx: ReqCtx,
  ): Promise<RoleOutput | ModServiceOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.modService(reqCtx)
    } else {
      return this.role(reqCtx)
    }
  }

  parseRoleCreds(req: express.Request) {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    const { Missing, Valid, Invalid } = RoleStatus
    if (!parsed) {
      return { status: Missing, admin: false, moderator: false, triage: false }
    }
    const { username, password } = parsed
    if (username === 'admin' && this.adminPasses.has(password)) {
      return { status: Valid, admin: true }
    }
    return { status: Invalid, admin: false }
  }

  async verifyServiceJwt(
    reqCtx: ReqCtx,
    opts: {
      iss: string[] | null
      aud: string | null
      lxmCheck?: (method?: string) => boolean
    },
  ) {
    const getSigningKey = async (
      iss: string,
      _forceRefresh: boolean, // @TODO consider propagating to dataplane
    ): Promise<string> => {
      if (opts.iss !== null && !opts.iss.includes(iss)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      const [did, serviceId] = iss.split('#')
      const keyId =
        serviceId === 'atproto_labeler' ? 'atproto_label' : 'atproto'
      let identity: GetIdentityByDidResponse
      try {
        identity = await this.dataplane.getIdentityByDid({ did })
      } catch (err) {
        if (isDataplaneError(err, Code.NotFound)) {
          throw new AuthRequiredError('identity unknown')
        }
        throw err
      }
      const keys = unpackIdentityKeys(identity.keys)
      const didKey = getKeyAsDidKey(keys, { id: keyId })
      if (!didKey) {
        throw new AuthRequiredError('missing or bad key')
      }
      return didKey
    }
    const assertLxmCheck = () => {
      const lxm = parseReqNsid(reqCtx.req)
      if (
        (opts.lxmCheck && !opts.lxmCheck(payload.lxm)) ||
        (!opts.lxmCheck && payload.lxm !== lxm)
      ) {
        throw new AuthRequiredError(
          payload.lxm !== undefined
            ? `bad jwt lexicon method ("lxm"). must match: ${lxm}`
            : `missing jwt lexicon method ("lxm"). must match: ${lxm}`,
          'BadJwtLexiconMethod',
        )
      }
    }

    const jwtStr = bearerTokenFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    // if validating additional scopes, skip scope check in initial validation & follow up afterwards
    const payload = await verifyServiceJwt(
      jwtStr,
      opts.aud,
      null,
      getSigningKey,
      verifySignatureWithKey,
    )
    if (
      !payload.iss.endsWith('#atproto_labeler') ||
      payload.lxm !== undefined
    ) {
      // @TODO currently permissive of labelers who dont set lxm yet.
      // we'll allow ozone self-hosters to upgrade before removing this condition.
      assertLxmCheck()
    }
    return { iss: payload.iss, aud: payload.aud }
  }

  isModService(iss: string): boolean {
    return [
      this.modServiceDid,
      `${this.modServiceDid}#atproto_labeler`,
    ].includes(iss)
  }

  nullCreds(): NullOutput {
    return {
      credentials: {
        type: 'none',
        iss: null,
      },
    }
  }

  parseCreds(
    creds: StandardOutput | RoleOutput | ModServiceOutput | NullOutput,
  ) {
    const viewer =
      creds.credentials.type === 'standard' ? creds.credentials.iss : null
    const includeTakedownsAnd3pBlocks =
      (creds.credentials.type === 'role' && creds.credentials.admin) ||
      creds.credentials.type === 'mod_service' ||
      (creds.credentials.type === 'standard' &&
        this.isModService(creds.credentials.iss))
    const canPerformTakedown =
      (creds.credentials.type === 'role' && creds.credentials.admin) ||
      creds.credentials.type === 'mod_service'

    return {
      viewer,
      includeTakedowns: includeTakedownsAnd3pBlocks,
      include3pBlocks: includeTakedownsAnd3pBlocks,
      canPerformTakedown,
    }
  }
}

// HELPERS
// ---------

const BEARER = 'Bearer '
const BASIC = 'Basic '

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

const isBasicToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BASIC) ?? false
}

const bearerTokenFromReq = (req: express.Request) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith(BEARER)) return null
  return header.slice(BEARER.length).trim()
}

export const parseBasicAuth = (
  token: string,
): { username: string; password: string } | null => {
  if (!token.startsWith(BASIC)) return null
  const b64 = token.slice(BASIC.length)
  let parsed: string[]
  try {
    parsed = ui8.toString(ui8.fromString(b64, 'base64pad'), 'utf8').split(':')
  } catch (err) {
    return null
  }
  const [username, password] = parsed
  if (!username || !password) return null
  return { username, password }
}

export const buildBasicAuth = (username: string, password: string): string => {
  return (
    BASIC +
    ui8.toString(ui8.fromString(`${username}:${password}`, 'utf8'), 'base64pad')
  )
}

const keyEncoder = new KeyEncoder('secp256k1')
export const createPublicKeyObject = (publicKeyHex: string): KeyObject => {
  const key = keyEncoder.encodePublic(publicKeyHex, 'raw', 'pem')
  return crypto.createPublicKey({ format: 'pem', key })
}

const verifySig = (
  publicKey: Uint8Array,
  data: Uint8Array,
  sig: Uint8Array,
) => {
  const keyEncoder = new KeyEncoder('secp256k1')

  const pemKey = keyEncoder.encodePublic(
    ui8.toString(publicKey, 'hex'),
    'raw',
    'pem',
  )
  const key = crypto.createPublicKey({ format: 'pem', key: pemKey })

  return crypto.verify(
    'sha256',
    data,
    {
      key,
      dsaEncoding: 'ieee-p1363',
    },
    sig,
  )
}

export const verifySignatureWithKey: VerifySignatureWithKeyFn = async (
  didKey: string,
  msgBytes: Uint8Array,
  sigBytes: Uint8Array,
  alg: string,
) => {
  if (alg === SECP256K1_JWT_ALG) {
    const parsed = parseDidKey(didKey)
    if (alg !== parsed.jwtAlg) {
      throw new Error(`Expected key alg ${alg}, got ${parsed.jwtAlg}`)
    }

    return verifySig(parsed.keyBytes, msgBytes, sigBytes)
  }

  return cryptoVerifySignatureWithKey(didKey, msgBytes, sigBytes, alg)
}
