/*
  How AppView verifies auth:
  1. `standardRead`, `standardWriteService`, `standardReadOptional`: called by app clients. Service JWT signed with the user's account key, an entryway session token, or a BSG token carrying the scope in the verifier's name (`read` or `write:service`). Service JWTs and entryway session tokens are accepted by all three. Used across `app.bsky.*`.
  2. `role`: called by administrators and internal services such as Rolodex. Basic auth with username `admin` and a configured admin password. Used for contact notifications and admin-capable routes.
  3. `internal`: called by internal services such as Chat. Token signed with the secret configured for the service named by `iss`. `sub` is the user's DID, when the call is for a user. Same access as the admin password.
  4. `modService`: called by Ozone. Service JWT signed with its labeler key, or its account key for legacy issuers without a fragment. Accepted on `com.atproto.admin.getSubjectStatus` and `com.atproto.admin.updateSubjectStatus` through `roleOrModService`.

  Optional variants allow anonymous requests.
*/
import crypto, { type KeyObject } from 'node:crypto'
import { secp256k1 } from '@noble/curves/secp256k1'
import type express from 'express'
import * as jose from 'jose'
import * as ui8 from 'uint8arrays'
import { SECP256K1_JWT_ALG, parseDidKey } from '@atproto/crypto'
import { type DidString, isDidString } from '@atproto/lex-schema'
import {
  AuthRequiredError,
  ForbiddenError,
  type VerifySignatureWithKeyFn,
  cryptoVerifySignatureWithKey,
  extractUrlNsid,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import {
  Code,
  type DataPlaneClient,
  getKeyAsDidKey,
  isDataplaneError,
  unpackIdentityKeys,
} from '../data-plane/index.js'
import type { GetIdentityByDidResponse } from '../proto/bsky_pb.js'
import { type AuthVerifierName, events } from '../telemetry/events.js'

type ReqCtx = {
  req: express.Request
}

type StandardAuthOpts = {
  skipAudCheck?: boolean
  lxmCheck?: (method?: string) => boolean
}

type ScopedStandardAuthOpts = StandardAuthOpts & {
  scope: BsgScope
  requireUser: boolean
}

type BsgScope = 'read' | 'write:service'

enum RoleStatus {
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
    /** The service JWT from the user's PDS: wrapped in BSG's token as `service_auth`, or sent directly. Undefined on anonymous calls. */
    serviceJwt?: string
  }
}

type RoleOutput = {
  credentials: {
    type: 'role'
  }
}

type InternalOutput = {
  credentials: {
    type: 'internal'
    /** Name of the internal service, such as `chat` */
    iss: string
    sub: DidString | null
  }
}

type ParsedCreds = {
  viewer: StandardOutput['credentials']['iss'] | null
  includeTakedowns: boolean
  include3pBlocks: boolean
  canPerformTakedown: boolean
  isModService: boolean
  skipViewerBlocks: boolean
}

type ModServiceOutput = {
  credentials: {
    type: 'mod_service'
    aud: DidString
    iss: DidString | `${DidString}#${string}`
  }
}

const ALLOWED_AUTH_SCOPES = new Set([
  'com.atproto.access',
  'com.atproto.appPass',
  'com.atproto.appPassPrivileged',
])

type AuthVerifierOpts = {
  ownDid: DidString
  alternateAudienceDids: DidString[]
  modServiceDid: DidString
  adminPasses: string[]
  entrywayJwtPublicKey?: KeyObject
  bsgJwtSecret?: Uint8Array
  internalServiceSecrets?: Record<string, Uint8Array>
}

export class AuthVerifier {
  public ownDid: DidString
  public standardAudienceDids: Set<DidString>
  public modServiceDid: DidString
  private adminPasses: Set<string>
  private entrywayJwtPublicKey?: KeyObject
  private bsgJwtSecret?: Uint8Array
  private internalServiceSecrets: Map<string, Uint8Array>

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
    this.bsgJwtSecret = opts.bsgJwtSecret
    this.internalServiceSecrets = new Map(
      Object.entries(opts.internalServiceSecrets ?? {}),
    )
  }

  // #region Auth-verification methods.

  // `scope` is the scope required from BSG tokens. With `requireUser`, a
  // request without a user is rejected inside the try, so it's counted as a
  // failure.
  private standardOptionalParameterized(
    opts: ScopedStandardAuthOpts & { requireUser: true },
  ): (ctx: ReqCtx) => Promise<StandardOutput>
  private standardOptionalParameterized(
    opts: ScopedStandardAuthOpts & { requireUser: false },
  ): (ctx: ReqCtx) => Promise<StandardOutput | NullOutput>
  private standardOptionalParameterized(opts: ScopedStandardAuthOpts) {
    return async (ctx: ReqCtx): Promise<StandardOutput | NullOutput> => {
      let verifier: AuthVerifierName = 'standard'
      let did: string | undefined
      let appPassword: boolean | undefined
      let iat: number | undefined
      let err: unknown
      try {
        if (isBearerToken(ctx.req)) {
          // @NOTE temporarily accept entryway session tokens to shed load from PDS instances
          const token = bearerTokenFromReq(ctx.req)
          if (!token) {
            throw new AuthRequiredError('missing jwt', 'MissingJwt')
          }
          const header = jose.decodeProtectedHeader(token)
          if (header.typ === BSG_JWT_TYP) {
            verifier = 'bsg'
            // await so a rejection is caught below and logged as a failure
            const output = await this.bsg(ctx, token, opts.scope)
            if (opts.requireUser && output.credentials.type === 'none') {
              throw new AuthRequiredError(undefined, 'AuthMissing')
            }
            return output
          }
          if (header.typ === 'at+jwt') {
            verifier = 'entrywaySession'
            // Claimed session, for logging. Only trusted once entrywaySession() succeeds.
            ;({ did, appPassword, iat } = claimedSession(token))
            // we should never use entryway session tokens in the case of flexible auth audiences (namely in the case of getFeed)
            if (opts.skipAudCheck) {
              throw new AuthRequiredError('Malformed token', 'InvalidToken')
            }
            // await so a rejection is caught below and logged as a failure
            return await this.entrywaySession(token)
          }

          const { iss, aud } = await this.verifyServiceJwt(ctx, token, {
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

          // Direct atproto-proxy token, from the PDS. For deployments without a BSG.
          return {
            credentials: {
              type: 'standard',
              iss,
              aud,
              serviceJwt: token,
            },
          }
        } else {
          if (opts.requireUser) {
            throw new AuthRequiredError(undefined, 'AuthMissing')
          }
          verifier = 'anonymous'
          return this.nullCreds()
        }
      } catch (e) {
        err = e
        throw e
      } finally {
        events.authVerifierRequest(verifier, {
          did,
          appPassword,
          iat,
          method: extractUrlNsid(ctx.req.originalUrl),
          userAgent: ctx.req.headers['user-agent'],
          origin: ctx.req.headers.origin,
          err,
        })
      }
    }
  }

  standardReadOptional = (opts: StandardAuthOpts = {}) =>
    this.standardOptionalParameterized({
      ...opts,
      scope: 'read',
      requireUser: false,
    })

  standardRead = (opts: StandardAuthOpts = {}) =>
    this.standardOptionalParameterized({
      ...opts,
      scope: 'read',
      requireUser: true,
    })

  standardWriteService = (opts: StandardAuthOpts = {}) =>
    this.standardOptionalParameterized({
      ...opts,
      scope: 'write:service',
      requireUser: true,
    })

  role = (ctx: ReqCtx): RoleOutput => {
    events.authVerifierRequest('role')
    if (this.checkAdminPassword(ctx.req) !== RoleStatus.Valid) {
      throw new AuthRequiredError()
    }
    return { credentials: { type: 'role' } }
  }

  standardReadOrRoleOptional = async (
    ctx: ReqCtx,
  ): Promise<StandardOutput | RoleOutput | NullOutput> => {
    if (isBearerToken(ctx.req)) {
      // A bearer token can be a BSG token without `sub` (anonymous request).
      // `standardRead` would reject it, so this uses `standardReadOptional`.
      return await this.standardReadOptional()(ctx)
    } else {
      const status = this.checkAdminPassword(ctx.req)
      events.authVerifierRequest(
        status === RoleStatus.Missing ? 'anonymous' : 'role',
      )
      if (status === RoleStatus.Valid) {
        return { credentials: { type: 'role' } }
      } else if (status === RoleStatus.Missing) {
        return this.nullCreds()
      } else {
        throw new AuthRequiredError()
      }
    }
  }

  internal = async (ctx: ReqCtx): Promise<InternalOutput> => {
    events.authVerifierRequest('internal')
    return this.internalService(ctx)
  }

  internalOrRole = async (
    ctx: ReqCtx,
  ): Promise<InternalOutput | RoleOutput> => {
    if (isBearerToken(ctx.req)) {
      return this.internal(ctx)
    } else {
      return this.role(ctx)
    }
  }

  modService = async (reqCtx: ReqCtx): Promise<ModServiceOutput> => {
    events.authVerifierRequest('modService')
    const token = bearerTokenFromReq(reqCtx.req)
    const { iss, aud } = await this.verifyServiceJwt(reqCtx, token, {
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

  // #endregion

  // #region Credential parsing.

  parseCreds(
    creds:
      | StandardOutput
      | RoleOutput
      | InternalOutput
      | ModServiceOutput
      | NullOutput,
  ): ParsedCreds {
    const viewer =
      creds.credentials.type === 'standard'
        ? creds.credentials.iss
        : creds.credentials.type === 'internal'
          ? creds.credentials.sub
          : null

    const isAdminAccess =
      creds.credentials.type === 'role' || creds.credentials.type === 'internal'

    const includeTakedownsAnd3pBlocks =
      isAdminAccess ||
      creds.credentials.type === 'mod_service' ||
      (creds.credentials.type === 'standard' &&
        this.isModService(creds.credentials.iss))

    const canPerformTakedown =
      isAdminAccess || creds.credentials.type === 'mod_service'

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

  // #endregion

  // #region Helpers.

  // @NOTE this auth verifier method is not recommended to be implemented by most appviews
  // this is a short term fix to remove proxy load from Bluesky's PDS and in line with possible
  // future plans to have the client talk directly with the appview
  private entrywaySession = async (
    token: string | null,
  ): Promise<StandardOutput> => {
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

    const { sub, aud, scope, cnf } = res.payload
    if (typeof cnf !== 'undefined') {
      // Proof-of-Possession (PoP) tokens are not allowed here
      // https://www.rfc-editor.org/rfc/rfc7800.html
      throw new AuthRequiredError(
        'Malformed token: DPoP not supported',
        'InvalidToken',
      )
    }
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
        iss: sub as DidString | `${DidString}#${string}`,
      },
    }
  }

  // Permission token issued by BSG for the requests it forwards. Without `sub`,
  // the request is anonymous.
  private bsg = async (
    reqCtx: ReqCtx,
    token: string,
    scope: BsgScope,
  ): Promise<StandardOutput | NullOutput> => {
    if (!this.bsgJwtSecret) {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    }

    const payload = await this.verifyHmacJwt(reqCtx, token, this.bsgJwtSecret, {
      typ: BSG_JWT_TYP,
      issuer: BSG_JWT_ISSUER,
      audience: BSG_JWT_AUDIENCE,
    })
    if (!Array.isArray(payload.scopes) || !payload.scopes.includes(scope)) {
      throw new ForbiddenError(
        `token lacks required scope: ${scope}`,
        'InsufficientScope',
      )
    }
    if (payload.sub === undefined) {
      return this.nullCreds()
    }
    if (!isDidString(payload.sub)) {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    }
    return {
      credentials: {
        type: 'standard',
        aud: this.ownDid,
        iss: payload.sub,
        // From atproto-proxy, has a service JWT. From oauth, it doesn't have a service JWT.
        serviceJwt:
          typeof payload.service_auth === 'string'
            ? payload.service_auth
            : undefined,
      },
    }
  }

  // Token signed by an internal service, such as Chat, with the secret
  // configured for it.
  private internalService = async (reqCtx: ReqCtx): Promise<InternalOutput> => {
    const token = bearerTokenFromReq(reqCtx.req)
    if (!token) throw new AuthRequiredError(undefined, 'AuthMissing')

    let issuer: unknown
    try {
      issuer = jose.decodeJwt(token).iss
    } catch {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    }
    if (typeof issuer !== 'string') {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    }
    const secret = this.internalServiceSecrets.get(issuer)
    if (!secret) {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    }

    const payload = await this.verifyHmacJwt(reqCtx, token, secret, {
      typ: INTERNAL_JWT_TYP,
      issuer,
      audience: INTERNAL_JWT_AUDIENCE,
    })
    if (payload.sub !== undefined && !isDidString(payload.sub)) {
      throw new AuthRequiredError('Malformed token', 'InvalidToken')
    }
    return {
      credentials: {
        type: 'internal',
        iss: issuer,
        sub: payload.sub ?? null,
      },
    }
  }

  // Verifies tokens signed with a shared secret.
  private async verifyHmacJwt(
    reqCtx: ReqCtx,
    token: string,
    secret: Uint8Array,
    opts: { typ: string; issuer: string; audience: string },
  ): Promise<jose.JWTPayload> {
    const { payload } = await jose
      .jwtVerify(token, secret, {
        algorithms: ['HS256'],
        typ: opts.typ,
        issuer: opts.issuer,
        audience: opts.audience,
        requiredClaims: ['exp', 'lxm'],
      })
      .catch((err) => {
        if (err?.['code'] === 'ERR_JWT_EXPIRED') {
          throw new AuthRequiredError('Token has expired', 'ExpiredToken')
        }
        throw new AuthRequiredError(
          'Token could not be verified',
          'InvalidToken',
        )
      })

    const lxm = parseReqNsid(reqCtx.req)
    if (payload.lxm !== lxm) {
      throw new AuthRequiredError(
        `bad jwt lexicon method ("lxm"). must match: ${lxm}`,
        'BadJwtLexiconMethod',
      )
    }
    return payload
  }

  private checkAdminPassword(req: express.Request): RoleStatus {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    if (!parsed) {
      return RoleStatus.Missing
    }
    const { username, password } = parsed
    if (username === 'admin' && this.adminPasses.has(password)) {
      return RoleStatus.Valid
    }
    return RoleStatus.Invalid
  }

  private async verifyServiceJwt<
    TOptions extends {
      iss: string[] | null
      aud: string | null
      lxmCheck?: (method?: string) => boolean
    },
  >(reqCtx: ReqCtx, jwtStr: string | null, opts: TOptions) {
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

  private isModService(
    iss: string,
  ): iss is DidString | `${DidString}#atproto_labeler` {
    return [
      this.modServiceDid,
      `${this.modServiceDid}#atproto_labeler`,
    ].includes(iss)
  }

  private nullCreds(): NullOutput {
    return {
      credentials: {
        type: 'none',
        iss: null,
      },
    }
  }

  // #endregion
}

const BEARER = 'Bearer '
const BASIC = 'Basic '

const BSG_JWT_TYP = 'bsg+jwt'
const BSG_JWT_ISSUER = 'bsg'
const BSG_JWT_AUDIENCE = 'bsky'
const INTERNAL_JWT_TYP = 'internal+jwt'
const INTERNAL_JWT_AUDIENCE = 'bsky'

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

const bearerTokenFromReq = (req: express.Request): string | null => {
  const header = req.headers.authorization || ''
  if (!header.startsWith(BEARER)) return null
  return header.slice(BEARER.length).trim()
}

const claimedSession = (
  token: string | null,
): { did?: string; appPassword?: boolean; iat?: number } => {
  if (!token) return {}
  try {
    const { sub, scope, iat } = jose.decodeJwt(token)
    return {
      did: typeof sub === 'string' ? sub : undefined,
      appPassword:
        scope === 'com.atproto.appPass' ||
        scope === 'com.atproto.appPassPrivileged',
      iat: typeof iat === 'number' ? iat : undefined,
    }
  } catch {
    return {}
  }
}

const parseBasicAuth = (
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

export const createPublicKeyObject = (publicKeyHex: string): KeyObject => {
  return createSecp256k1KeyObject(publicKeyHex)
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

const verifySignatureWithKey: VerifySignatureWithKeyFn = async (
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
