import crypto, { type KeyObject } from 'node:crypto'
import { secp256k1 } from '@noble/curves/secp256k1'
import type express from 'express'
import * as ui8 from 'uint8arrays'
import { SECP256K1_JWT_ALG, parseDidKey } from '@atproto/crypto'
import { type DidString, isDidString } from '@atproto/lex-schema'
import {
  AuthRequiredError,
  type VerifySignatureWithKeyFn,
  cryptoVerifySignatureWithKey,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import {
  Code,
  type DataPlaneClient,
  getKeyAsDidKey,
  isDataplaneError,
  unpackIdentityKeys,
} from './data-plane/index.js'
import type { GetIdentityByDidResponse } from './proto/bsky_pb.js'

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
    /** @note we don't validate this to be a {@link DidString} (we might want to in the future) */
    aud: string
    iss: DidString | `${DidString}#${string}`
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
    aud: DidString
    iss: DidString | `${DidString}#${string}`
  }
}

export type AuthVerifierOpts = {
  ownDid: DidString
  alternateAudienceDids: DidString[]
  modServiceDid: DidString
  adminPasses: string[]
}

export class AuthVerifier {
  public ownDid: DidString
  public standardAudienceDids: Set<DidString>
  public modServiceDid: DidString
  private adminPasses: Set<string>

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
  }

  // verifiers (arrow fns to preserve scope)
  standardOptionalParameterized =
    (opts: StandardAuthOpts) =>
    async (ctx: ReqCtx): Promise<StandardOutput | NullOutput> => {
      // @TODO remove! basic auth + did supported just for testing.
      if (isBasicToken(ctx.req)) {
        const aud = this.ownDid
        const iss = ctx.req.headers['appview-as-did']
        if (typeof iss !== 'string' || !isDidString(iss)) {
          throw new AuthRequiredError('bad issuer')
        }
        if (!this.parseRoleCreds(ctx.req).admin) {
          throw new AuthRequiredError('bad credentials')
        }
        return {
          credentials: { type: 'standard', iss, aud },
        }
      } else if (isBearerToken(ctx.req)) {
        const { iss, aud } = await this.verifyServiceJwt(ctx, {
          lxmCheck: opts.lxmCheck,
          iss: null,
          aud: null,
        })
        if (
          !opts.skipAudCheck &&
          !(this.standardAudienceDids as Set<string>).has(aud)
        ) {
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

  async verifyServiceJwt<
    TOptions extends {
      iss: string[] | null
      aud: string | null
      lxmCheck?: (method?: string) => boolean
    },
  >(reqCtx: ReqCtx, opts: TOptions) {
    const getSigningKey = async (
      iss: string,
      _forceRefresh: boolean, // @TODO consider propagating to dataplane
    ): Promise<string> => {
      if (opts.iss !== null && !opts.iss.includes(iss)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      const [did, serviceId] = iss.split('#')
      if (!isDidString(did)) {
        throw new AuthRequiredError('identity unknown')
      }

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

    return {
      iss: payload.iss as (DidString | `${DidString}#${string}`) &
        (TOptions extends { iss: ReadonlyArray<infer I> } ? I : unknown),
      aud: payload.aud as string &
        (TOptions extends { aud: infer A extends string } ? A : unknown),
    }
  }

  isModService(iss: string): iss is DidString | `${DidString}#atproto_labeler` {
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
    const isModService =
      creds.credentials.type === 'mod_service' ||
      (creds.credentials.type === 'standard' &&
        this.isModService(creds.credentials.iss))

    return {
      viewer,
      includeTakedowns: includeTakedownsAnd3pBlocks,
      include3pBlocks: includeTakedownsAnd3pBlocks,
      canPerformTakedown,
      isModService,
      skipViewerBlocks: isModService && viewer !== null,
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

const createSecp256k1KeyObject = (
  publicKey: Uint8Array | string,
): KeyObject => {
  // accepts compressed or uncompressed keys; validates the point is on-curve
  const point = secp256k1.ProjectivePoint.fromHex(publicKey).toRawBytes(false)
  return crypto.createPublicKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'secp256k1',
      x: ui8.toString(point.subarray(1, 33), 'base64url'),
      y: ui8.toString(point.subarray(33, 65), 'base64url'),
    },
  })
}

const verifySig = (
  publicKey: Uint8Array,
  data: Uint8Array,
  sig: Uint8Array,
) => {
  const key = createSecp256k1KeyObject(publicKey)

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
