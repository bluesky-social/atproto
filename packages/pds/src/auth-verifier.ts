import { KeyObject, createPublicKey, createSecretKey } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'
import { getVerificationMaterial } from '@atproto/common'
import { IdResolver, getDidKeyFromMultibase } from '@atproto/identity'
import {
  OAuthError,
  OAuthVerifier,
  VerifyTokenClaimsOptions,
  WWWAuthenticateError,
} from '@atproto/oauth-provider'
import {
  AuthRequiredError,
  Awaitable,
  ForbiddenError,
  InvalidRequestError,
  MethodAuthContext,
  MethodAuthVerifier,
  Params,
  XRPCError,
  excludeErrorResult,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import { AccountManager } from './account-manager/account-manager'
import {
  AccessOutput,
  AdminTokenOutput,
  AuthorizationOutput,
  ModServiceOutput,
  NullOutput,
  OAuthOutput,
  RefreshOutput,
  UserServiceAuthOutput,
} from './auth-output'
import {
  ACCESS_FULL,
  ACCESS_STANDARD,
  AuthScope,
  isAuthScope,
} from './auth-scope'
import { softDeleted } from './db'
import { oauthLogger } from './logger'
import {
  PermissionSet,
  PermissionsAppPass,
  PermissionsAppPassPrivileged,
  PermissionsFull,
  PermissionsOAuth,
  PermissionsSignupQueued,
  PermissionsTakendown,
} from './permissions/index.js'
import { appendVary } from './util/http'
import { WithRequired } from './util/types'

export type VerifiedOptions = {
  checkTakedown?: boolean
  checkDeactivated?: boolean
}

export type ScopedOptions<S extends AuthScope = AuthScope> = {
  scopes: readonly S[]
}

export type ExtraScopedOptions<S extends AuthScope = AuthScope> = {
  extraScopes?: readonly S[]
}

export type AuthorizedOptions<P extends Params = Params> = {
  authorize?: (
    ctx: MethodAuthContext<P> & { permissions: PermissionSet },
  ) => Awaitable<void>
}

export type AuthVerifierOpts = {
  publicUrl: string
  jwtKey: KeyObject
  adminPass: string
  dids: {
    pds: string
    entryway?: string
    modService?: string
  }
}

export type VerifyBearerJwtOptions<S extends AuthScope = AuthScope> =
  WithRequired<
    Omit<jose.JWTVerifyOptions, 'scopes'> & {
      scopes: readonly S[]
    },
    'audience' | 'typ'
  >

export type VerifyBearerJwtResult<S extends AuthScope = AuthScope> = {
  sub: string
  aud: string
  jti: string | undefined
  scope: S
}

export class AuthVerifier {
  private _publicUrl: string
  private _jwtKey: KeyObject
  private _adminPass: string
  public dids: AuthVerifierOpts['dids']

  constructor(
    public accountManager: AccountManager,
    public idResolver: IdResolver,
    public oauthVerifier: OAuthVerifier,
    opts: AuthVerifierOpts,
  ) {
    this._publicUrl = opts.publicUrl
    this._jwtKey = opts.jwtKey
    this._adminPass = opts.adminPass
    this.dids = opts.dids
  }

  // verifiers (arrow fns to preserve scope)

  public null: MethodAuthVerifier<NullOutput> = (ctx) => {
    setAuthHeaders(ctx.res)
    return {
      credentials: null,
    }
  }

  public adminToken: MethodAuthVerifier<AdminTokenOutput> = async (ctx) => {
    setAuthHeaders(ctx.res)
    const parsed = parseBasicAuth(ctx.req.headers.authorization)
    if (!parsed) {
      throw new AuthRequiredError()
    }
    const { username, password } = parsed
    if (username !== 'admin' || password !== this._adminPass) {
      throw new AuthRequiredError()
    }

    return { credentials: { type: 'admin_token' } }
  }

  public modService: MethodAuthVerifier<ModServiceOutput> = async (ctx) => {
    setAuthHeaders(ctx.res)
    if (!this.dids.modService) {
      throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
    }
    const payload = await this.verifyServiceJwt(ctx.req, {
      iss: [this.dids.modService, `${this.dids.modService}#atproto_labeler`],
    })
    return {
      credentials: {
        type: 'mod_service',
        did: payload.iss,
      },
    }
  }

  public moderator: MethodAuthVerifier<AdminTokenOutput | ModServiceOutput> =
    async (ctx) => {
      if (isBearerToken(ctx.req)) {
        return this.modService(ctx)
      } else {
        return this.adminToken(ctx)
      }
    }

  public access<S extends AuthScope>(
    options: VerifiedOptions & ScopedOptions<S>,
  ): MethodAuthVerifier<AccessOutput<S>> {
    const { scopes, ...verifyStatusOptions } = options

    const verifyJwtOptions: VerifyBearerJwtOptions<S> = {
      audience: this.dids.pds,
      typ: 'at+jwt',
      scopes:
        // @NOTE We can reject taken down credentials based on the scope if
        // "checkTakedown" is set.
        verifyStatusOptions.checkTakedown &&
        scopes.includes(AuthScope.Takendown as S)
          ? scopes.filter((s) => s !== AuthScope.Takendown)
          : scopes,
    }

    return async (ctx) => {
      setAuthHeaders(ctx.res)
      const { sub: did, scope } = await this.verifyBearerJwt(
        ctx.req,
        verifyJwtOptions,
      )

      await this.verifyStatus(did, verifyStatusOptions)

      return {
        credentials: { type: 'access', did, scope },
      }
    }
  }

  public accessStandard<S extends AuthScope = never>({
    extraScopes = [],
    ...options
  }: VerifiedOptions & ExtraScopedOptions<S> = {}) {
    const scopes = [...ACCESS_STANDARD, ...extraScopes]
    return this.access({ ...options, scopes })
  }

  public accessFull<S extends AuthScope = never>({
    extraScopes = [],
    ...options
  }: VerifiedOptions & ExtraScopedOptions<S> = {}) {
    const scopes = [...ACCESS_FULL, ...extraScopes]
    return this.access({ ...options, scopes })
  }

  public refresh(options?: {
    allowExpired?: boolean
  }): MethodAuthVerifier<RefreshOutput> {
    const verifyOptions: VerifyBearerJwtOptions<AuthScope.Refresh> = {
      clockTolerance: options?.allowExpired ? Infinity : undefined,
      typ: 'refresh+jwt',
      // when using entryway, proxying refresh credentials
      audience: this.dids.entryway ? this.dids.entryway : this.dids.pds,
      scopes: [AuthScope.Refresh],
    }

    return async (ctx) => {
      setAuthHeaders(ctx.res)

      const result = await this.verifyBearerJwt(ctx.req, verifyOptions)

      const tokenId = result.jti
      if (!tokenId) {
        throw new AuthRequiredError(
          'Unexpected missing refresh token id',
          'MissingTokenId',
        )
      }

      return {
        credentials: {
          type: 'refresh',
          did: result.sub,
          scope: result.scope,
          tokenId,
        },
      }
    }
  }

  public authorization<P extends Params>({
    extraScopes = [],
    authorize,
    ...options
  }: VerifiedOptions &
    ExtraScopedOptions &
    AuthorizedOptions<P> = {}): MethodAuthVerifier<AuthorizationOutput, P> {
    const scopes = [...ACCESS_STANDARD, ...extraScopes]
    const access = this.access({ ...options, scopes })
    const oauth = this.oauth(options)

    return async (ctx) => {
      const [type] = parseAuthorizationHeader(ctx.req.headers.authorization)

      if (type === AuthType.BEARER) {
        const { credentials } = excludeErrorResult(await access(ctx))
        const permissions = buildScopePermissionSet(credentials.scope)
        if (authorize) await authorize({ ...ctx, permissions })

        return {
          credentials: {
            type: 'authorization',
            did: credentials.did,
            permissions,
          },
        }
      }

      if (type === AuthType.DPOP) {
        const { credentials } = excludeErrorResult(await oauth(ctx))
        const permissions = new PermissionsOAuth(credentials.tokenClaims)
        if (authorize) await authorize({ ...ctx, permissions })

        return {
          credentials: {
            type: 'authorization',
            did: credentials.did,
            permissions,
          },
        }
      }

      // Auth headers are set through the access and oauth methods so we only
      // need to set them here if we reach this point
      setAuthHeaders(ctx.res)

      if (type !== null) {
        throw new InvalidRequestError(
          'Unexpected authorization type',
          'InvalidToken',
        )
      }

      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
  }

  public authorizationOrAdminTokenOptional<P extends Params>(
    opts: VerifiedOptions & ExtraScopedOptions & AuthorizedOptions<P> = {},
  ): MethodAuthVerifier<
    AuthorizationOutput | AdminTokenOutput | NullOutput,
    P
  > {
    const authorization = this.authorization(opts)
    return async (ctx) => {
      if (isAccessToken(ctx.req)) {
        return await authorization(ctx)
      } else if (isBasicToken(ctx.req)) {
        return await this.adminToken(ctx)
      } else {
        return this.null(ctx)
      }
    }
  }

  public userServiceAuth: MethodAuthVerifier<UserServiceAuthOutput> = async (
    ctx,
  ) => {
    setAuthHeaders(ctx.res)
    const payload = await this.verifyServiceJwt(ctx.req)
    return {
      credentials: {
        type: 'user_service_auth',
        did: payload.iss,
      },
    }
  }

  public userServiceAuthOptional: MethodAuthVerifier<
    UserServiceAuthOutput | NullOutput
  > = async (ctx) => {
    if (isBearerToken(ctx.req)) {
      return await this.userServiceAuth(ctx)
    } else {
      return this.null(ctx)
    }
  }

  public authorizationOrUserServiceAuth<P extends Params>(
    options: Partial<VerifiedOptions & AuthorizedOptions<P>> = {},
  ): MethodAuthVerifier<UserServiceAuthOutput | AuthorizationOutput, P> {
    const authorizationVerifier = this.authorization(options)
    return async (ctx) => {
      if (isUserServiceAuth(ctx.req)) {
        return this.userServiceAuth(ctx)
      } else {
        return authorizationVerifier(ctx)
      }
    }
  }

  public oauth<P extends Params>(
    verifyStatusOptions: VerifiedOptions = {},
  ): MethodAuthVerifier<OAuthOutput, P> {
    const verifyTokenOptions: VerifyTokenClaimsOptions = {
      audience: [this.dids.pds],
      scope: ['atproto'],
    }

    return async (ctx) => {
      setAuthHeaders(ctx.res)

      const { req, res } = ctx

      // https://datatracker.ietf.org/doc/html/rfc9449#section-8.2
      const dpopNonce = this.oauthVerifier.nextDpopNonce()
      if (dpopNonce) {
        res.setHeader('DPoP-Nonce', dpopNonce)
        res.appendHeader('Access-Control-Expose-Headers', 'DPoP-Nonce')
      }

      const originalUrl = req.originalUrl || req.url || '/'
      const url = new URL(originalUrl, this._publicUrl)

      const { tokenClaims, dpopProof } = await this.oauthVerifier
        .authenticateRequest(
          req.method || 'GET',
          url,
          req.headers,
          verifyTokenOptions,
        )
        .catch((err) => {
          // Make sure to include any WWW-Authenticate header in the response
          // (particularly useful for DPoP's "use_dpop_nonce" error)
          if (err instanceof WWWAuthenticateError) {
            res.setHeader('WWW-Authenticate', err.wwwAuthenticateHeader)
            res.appendHeader(
              'Access-Control-Expose-Headers',
              'WWW-Authenticate',
            )
          }

          if (err instanceof OAuthError) {
            throw new XRPCError(err.status, err.error_description, err.error)
          }

          throw err
        })

      // @TODO drop this once oauth provider no longer accepts DPoP proof with
      // query or fragment in "htu" claim.
      if (dpopProof?.htu.match(/[?#]/)) {
        oauthLogger.info(
          {
            client_id: tokenClaims.client_id,
            htu: dpopProof.htu,
          },
          'DPoP proof "htu" contains query or fragment',
        )
      }

      const { sub: did } = tokenClaims
      if (typeof did !== 'string' || !did.startsWith('did:')) {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }

      await this.verifyStatus(did, verifyStatusOptions)

      return {
        credentials: {
          type: 'oauth',
          did,
          tokenClaims,
        },
      }
    }
  }

  protected async verifyStatus(
    did: string,
    { checkTakedown = false, checkDeactivated = false }: VerifiedOptions,
  ): Promise<void> {
    if (checkTakedown || checkDeactivated) {
      const found = await this.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!found) {
        // will be turned into ExpiredToken for the client if proxied by entryway
        throw new ForbiddenError('Account not found', 'AccountNotFound')
      }
      if (checkTakedown && softDeleted(found)) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }
      if (checkDeactivated && found.deactivatedAt) {
        throw new AuthRequiredError(
          'Account is deactivated',
          'AccountDeactivated',
        )
      }
    }
  }

  /**
   * Wraps {@link jose.jwtVerify} into a function that also validates the token
   * payload's type and wraps errors into {@link InvalidRequestError}.
   */
  protected async verifyBearerJwt<S extends AuthScope = AuthScope>(
    req: IncomingMessage,
    { scopes, ...options }: VerifyBearerJwtOptions<S>,
  ): Promise<VerifyBearerJwtResult<S>> {
    const token = bearerTokenFromReq(req)
    if (!token) {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    try {
      const { payload } = await jose.jwtVerify(token, this._jwtKey, options)

      const { sub, aud, scope, lxm, cnf, jti } = payload

      if (typeof lxm !== 'undefined') {
        // Service auth tokens are not allowed here
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }
      if (typeof cnf !== 'undefined') {
        // Proof-of-Possession (PoP) tokens are not allowed here
        // https://www.rfc-editor.org/rfc/rfc7800.html
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }
      if (typeof sub !== 'string' || !sub.startsWith('did:')) {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }
      if (typeof aud !== 'string' || !aud.startsWith('did:')) {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }
      if (typeof jti !== 'string' && typeof jti !== 'undefined') {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }
      if (!isAuthScope(scope) || !scopes.includes(scope as any)) {
        throw new InvalidRequestError('Bad token scope', 'InvalidToken')
      }

      return { sub, aud, jti, scope: scope as S }
    } catch (cause) {
      throw cause instanceof jose.errors.JWTExpired
        ? new InvalidRequestError('Token has expired', 'ExpiredToken', {
            cause,
          })
        : new InvalidRequestError(
            'Token could not be verified',
            'InvalidToken',
            { cause },
          )
    }
  }

  protected async verifyServiceJwt(
    req: IncomingMessage,
    opts?: { iss?: string[] },
  ) {
    const getSigningKey = async (
      iss: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      if (opts?.iss && !opts.iss.includes(iss)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      const [did, serviceId] = iss.split('#')
      const keyId =
        serviceId === 'atproto_labeler' ? 'atproto_label' : 'atproto'
      const didDoc = await this.idResolver.did.resolve(did, forceRefresh)
      if (!didDoc) {
        throw new AuthRequiredError('could not resolve iss did')
      }
      const parsedKey = getVerificationMaterial(didDoc, keyId)
      if (!parsedKey) {
        throw new AuthRequiredError('missing or bad key in did doc')
      }
      const didKey = getDidKeyFromMultibase(parsedKey)
      if (!didKey) {
        throw new AuthRequiredError('missing or bad key in did doc')
      }
      return didKey
    }

    const jwtStr = bearerTokenFromReq(req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const nsid = parseReqNsid(req)
    const payload = await verifyServiceJwt(jwtStr, null, nsid, getSigningKey)
    if (
      payload.aud !== this.dids.pds &&
      (!this.dids.entryway || payload.aud !== this.dids.entryway)
    ) {
      throw new AuthRequiredError(
        'jwt audience does not match service did',
        'BadJwtAudience',
      )
    }
    return payload
  }
}

// HELPERS
// ---------

export function isUserOrAdmin(
  auth: AccessOutput | AuthorizationOutput | AdminTokenOutput | NullOutput,
  did: string,
): boolean {
  if (!auth.credentials) {
    return false
  } else if (auth.credentials.type === 'admin_token') {
    return true
  } else {
    return auth.credentials.did === did
  }
}

enum AuthType {
  BASIC = 'Basic',
  BEARER = 'Bearer',
  DPOP = 'DPoP',
}

const parseAuthorizationHeader = (
  authorization?: string,
): [type: null] | [type: AuthType, token: string] => {
  if (!authorization) return [null]

  const result = authorization.split(' ')
  if (result.length !== 2) {
    throw new InvalidRequestError(
      'Malformed authorization header',
      'InvalidToken',
    )
  }

  // authorization type is case-insensitive
  const authType = result[0].toUpperCase()

  const type = Object.hasOwn(AuthType, authType) ? AuthType[authType] : null
  if (type) return [type, result[1]]

  throw new InvalidRequestError(
    `Unsupported authorization type: ${result[0]}`,
    'InvalidToken',
  )
}

const isAccessToken = (req: IncomingMessage): boolean => {
  const [type] = parseAuthorizationHeader(req.headers.authorization)
  return type === AuthType.BEARER || type === AuthType.DPOP
}

const isBearerToken = (req: IncomingMessage): boolean => {
  const [type] = parseAuthorizationHeader(req.headers.authorization)
  return type === AuthType.BEARER
}

const isBasicToken = (req: IncomingMessage): boolean => {
  const [type] = parseAuthorizationHeader(req.headers.authorization)
  return type === AuthType.BASIC
}

const isUserServiceAuth = (req: IncomingMessage): boolean => {
  const token = bearerTokenFromReq(req)
  if (!token) return false
  const payload = jose.decodeJwt(token)
  return payload['lxm'] != null
}

const bearerTokenFromReq = (req: IncomingMessage) => {
  const [type, token] = parseAuthorizationHeader(req.headers.authorization)
  return type === AuthType.BEARER ? token : null
}

const parseBasicAuth = (
  authorizationHeader?: string,
): { username: string; password: string } | null => {
  try {
    const [type, b64] = parseAuthorizationHeader(authorizationHeader)
    if (type !== AuthType.BASIC) return null
    const decoded = Buffer.from(b64, 'base64').toString('utf8')
    // We must not use split(':') because the password can contain colons
    const colon = decoded.indexOf(':')
    if (colon === -1) return null
    const username = decoded.slice(0, colon)
    const password = decoded.slice(colon + 1)
    return { username, password }
  } catch (err) {
    return null
  }
}

export const createSecretKeyObject = (secret: string): KeyObject => {
  return createSecretKey(Buffer.from(secret))
}

const keyEncoder = new KeyEncoder('secp256k1')
export const createPublicKeyObject = (publicKeyHex: string): KeyObject => {
  const key = keyEncoder.encodePublic(publicKeyHex, 'raw', 'pem')
  return createPublicKey({ format: 'pem', key })
}

function setAuthHeaders(res: ServerResponse) {
  res.setHeader('Cache-Control', 'private')
  appendVary(res, 'Authorization')
}

// @NOTE using memoized map to avoid creating new instances of PermissionSet on
// every request
const scopePermissionSetMap = new Map<AuthScope, PermissionSet>([
  [AuthScope.Access, new PermissionsFull()],
  [AuthScope.AppPass, new PermissionsAppPass()],
  [AuthScope.AppPassPrivileged, new PermissionsAppPassPrivileged()],
  [AuthScope.SignupQueued, new PermissionsSignupQueued()],
  [AuthScope.Takendown, new PermissionsTakendown()],
])

function buildScopePermissionSet(scope: AuthScope): PermissionSet {
  const permissionSet = scopePermissionSetMap.get(scope)
  if (permissionSet) return permissionSet

  throw new InvalidRequestError('Invalid token scope', 'InvalidToken')
}
