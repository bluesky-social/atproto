import { type KeyObject, createPublicKey, createSecretKey } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { secp256k1 } from '@noble/curves/secp256k1'
import * as jose from 'jose'
import { getVerificationMaterial } from '@atproto/common'
import { type IdResolver, getDidKeyFromMultibase } from '@atproto/identity'
import {
  type AtIdentifierString,
  type DidString,
  isDidString,
} from '@atproto/lex-schema'
import {
  OAuthError,
  WWWAuthenticateError,
} from '@atproto/oauth-provider/errors'
import type {
  OAuthVerifier,
  VerifyTokenPayloadOptions,
} from '@atproto/oauth-provider/verifier'
import {
  type ScopePermissions,
  ScopePermissionsTransition,
} from '@atproto/oauth-scopes'
import {
  AuthRequiredError,
  type Awaitable,
  ForbiddenError,
  InvalidRequestError,
  type MethodAuthContext,
  type MethodAuthVerifier,
  type Params,
  XRPCError,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import type { AccountManager } from './account-manager/account-manager.js'
import type { ActorAccount } from './account-manager/helpers/account.js'
import type {
  AccessOutput,
  AdminTokenOutput,
  EntrywayServiceOutput,
  ModServiceOutput,
  OAuthOutput,
  RefreshOutput,
  UnauthenticatedOutput,
  UserServiceAuthOutput,
} from './auth-output.js'
import { ACCESS_STANDARD, AuthScope, isAuthScope } from './auth-scope.js'
import { softDeleted } from './db/index.js'
import { appendVary } from './util/http.js'
import { canonicalIp } from './util/ip.js'
import type { WithRequired } from './util/types.js'

export type VerifiedOptions = {
  checkTakedown?: boolean
  checkDeactivated?: boolean
}

export type ScopedOptions<S extends AuthScope = AuthScope> = {
  scopes?: readonly S[]
}

export type ExtraScopedOptions<S extends AuthScope = AuthScope> = {
  additional?: readonly S[]
}

export type AuthorizedOptions<P extends Params = Params> = {
  authorize: (
    permissions: ScopePermissions,
    ctx: MethodAuthContext<P>,
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
  entrywayServiceAuth?: {
    /** did:key form of the entryway's JWT verify key */
    didKey: string
    /** the same key, for verifying relay tokens with node:crypto */
    keyObject: KeyObject
    required: boolean
  }
}

const ENTRYWAY_SERVICE_JWT_MAX_LIFETIME_SEC = 5 * 60
const ENTRYWAY_RELAY_TOKEN_MAX_LIFETIME_SEC = 2 * 60
const ENTRYWAY_JWT_CLOCK_TOLERANCE_SEC = 30

/**
 * Why a relay token was refused. Kept to a short code so that logging it
 * reveals nothing of the token or of the client.
 */
export type EntrywayRelayTokenRejection =
  | 'not_configured'
  | 'malformed'
  | 'bad_alg'
  | 'bad_sig'
  | 'expired'
  | 'bad_typ'
  | 'wrong_iss'
  | 'wrong_aud'
  | 'has_lxm'
  | 'bad_iat'
  | 'bad_lifetime'
  | 'bad_client_ip'

export class EntrywayRelayTokenError extends Error {
  constructor(public readonly reason: EntrywayRelayTokenRejection) {
    super(`Invalid entryway relay token: ${reason}`)
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
  sub: DidString
  aud: string
  jti: string | undefined
  scope: S
}

export class AuthVerifier {
  private _publicUrl: string
  private _jwtKey: KeyObject
  private _adminPass: string
  private _entrywayServiceAuth: AuthVerifierOpts['entrywayServiceAuth']
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
    this._entrywayServiceAuth = opts.entrywayServiceAuth
    this.dids = opts.dids
  }

  // verifiers (arrow fns to preserve scope)

  public unauthenticated: MethodAuthVerifier<UnauthenticatedOutput> = (ctx) => {
    setAuthHeaders(ctx.res)

    // @NOTE this auth method is typically used as fallback when no other auth
    // method is applicable. This means that the presence of an "authorization"
    // header means that that header is invalid (as it did not match any of the
    // other auth methods).
    if (ctx.req.headers['authorization']) {
      throw new AuthRequiredError('Invalid authorization header')
    }

    return {
      credentials: null,
    }
  }

  /** @deprecated We are steering away from this auth method */
  public adminToken: MethodAuthVerifier<AdminTokenOutput> = async (ctx) => {
    setAuthHeaders(ctx.res)
    const parsed = parseBasicAuth(ctx.req)
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

  /** @deprecated We are steering away from {@link adminToken} auth. Use {@link modService} instead. */
  public moderator: MethodAuthVerifier<AdminTokenOutput | ModServiceOutput> =
    async (ctx) => {
      const type = extractAuthType(ctx.req)
      if (type === AuthType.BEARER) {
        return this.modService(ctx)
      } else {
        return this.adminToken(ctx)
      }
    }

  public entrywayService: MethodAuthVerifier<EntrywayServiceOutput> = async (
    ctx,
  ) => {
    setAuthHeaders(ctx.res)
    const payload = await this.verifyEntrywayServiceJwt(ctx.req)
    return {
      credentials: {
        type: 'entryway_service',
        did: payload.iss,
      },
    }
  }

  public entrywayServiceOptional: MethodAuthVerifier<
    EntrywayServiceOutput | UnauthenticatedOutput
  > = async (ctx) => {
    if (extractAuthType(ctx.req) === AuthType.BEARER) {
      return this.entrywayService(ctx)
    }
    this.assertEntrywayServiceAuthNotRequired(ctx.res)
    return this.unauthenticated(ctx)
  }

  public adminTokenOrEntrywayService: MethodAuthVerifier<
    AdminTokenOutput | EntrywayServiceOutput
  > = async (ctx) => {
    if (!this._entrywayServiceAuth) {
      return this.adminToken(ctx)
    }
    if (extractAuthType(ctx.req) === AuthType.BEARER) {
      return this.entrywayService(ctx)
    }
    this.assertEntrywayServiceAuthNotRequired(ctx.res)
    return this.adminToken(ctx)
  }

  public moderatorOrEntrywayService: MethodAuthVerifier<
    AdminTokenOutput | ModServiceOutput | EntrywayServiceOutput
  > = async (ctx) => {
    if (extractAuthType(ctx.req) === AuthType.BEARER) {
      return this.isEntrywayIssuedJwt(ctx.req)
        ? this.entrywayService(ctx)
        : this.modService(ctx)
    }
    this.assertEntrywayServiceAuthNotRequired(ctx.res)
    return this.adminToken(ctx)
  }

  protected access<S extends AuthScope>(
    options: VerifiedOptions & Required<ScopedOptions<S>>,
  ): MethodAuthVerifier<AccessOutput<S>> {
    const { scopes, ...statusOptions } = options

    const verifyJwtOptions: VerifyBearerJwtOptions<S> = {
      audience: this.dids.pds,
      typ: 'at+jwt',
      scopes:
        // @NOTE We can reject taken down credentials based on the scope if
        // "checkTakedown" is set.
        statusOptions.checkTakedown && scopes.includes(AuthScope.Takendown as S)
          ? scopes.filter((s) => s !== AuthScope.Takendown)
          : scopes,
    }

    return async (ctx) => {
      setAuthHeaders(ctx.res)

      const { sub: did, scope } = await this.verifyBearerJwt(
        ctx.req,
        verifyJwtOptions,
      )

      await this.verifyStatus(did, statusOptions)

      return {
        credentials: { type: 'access', did, scope },
      }
    }
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
    scopes = ACCESS_STANDARD,
    additional = [],
    ...options
  }: VerifiedOptions &
    ScopedOptions &
    ExtraScopedOptions &
    AuthorizedOptions<P>): MethodAuthVerifier<AccessOutput | OAuthOutput, P> {
    const access = this.access({
      ...options,
      scopes: [...scopes, ...additional],
    })
    const oauth = this.oauth(options)

    return async (ctx) => {
      const type = extractAuthType(ctx.req)

      if (type === AuthType.BEARER) {
        return access(ctx)
      }

      if (type === AuthType.DPOP) {
        return oauth(ctx)
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

  public authorizationOrModService<P extends Params>(
    opts: VerifiedOptions & ExtraScopedOptions & AuthorizedOptions<P>,
  ): MethodAuthVerifier<AccessOutput | OAuthOutput | ModServiceOutput, P> {
    const authorization = this.authorization(opts)
    return async (ctx) => {
      try {
        return await this.modService(ctx)
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          return authorization(ctx)
        }
        throw err
      }
    }
  }

  public authorizationOrAdminTokenOptional<P extends Params>(
    opts: VerifiedOptions & ExtraScopedOptions & AuthorizedOptions<P>,
  ): MethodAuthVerifier<
    OAuthOutput | AccessOutput | AdminTokenOutput | UnauthenticatedOutput,
    P
  > {
    const authorization = this.authorization(opts)
    return async (ctx) => {
      const type = extractAuthType(ctx.req)
      if (type === AuthType.BEARER || type === AuthType.DPOP) {
        return authorization(ctx)
      } else if (type === AuthType.BASIC) {
        return this.adminToken(ctx)
      } else {
        return this.unauthenticated(ctx)
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
    UserServiceAuthOutput | UnauthenticatedOutput
  > = async (ctx) => {
    const type = extractAuthType(ctx.req)
    if (type === AuthType.BEARER) {
      return await this.userServiceAuth(ctx)
    } else {
      return this.unauthenticated(ctx)
    }
  }

  public authorizationOrUserServiceAuth<P extends Params>(
    options: VerifiedOptions &
      ScopedOptions &
      ExtraScopedOptions &
      AuthorizedOptions<P>,
  ): MethodAuthVerifier<UserServiceAuthOutput | OAuthOutput | AccessOutput, P> {
    const authorizationVerifier = this.authorization(options)
    return async (ctx) => {
      if (isDefinitelyServiceAuth(ctx.req)) {
        return this.userServiceAuth(ctx)
      } else {
        return authorizationVerifier(ctx)
      }
    }
  }

  protected oauth<P extends Params>({
    authorize,
    ...verifyStatusOptions
  }: VerifiedOptions & AuthorizedOptions<P>): MethodAuthVerifier<
    OAuthOutput,
    P
  > {
    const verifyTokenOptions: VerifyTokenPayloadOptions = {
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

      const { scope, sub: did } = await this.oauthVerifier
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

      if (!isDidString(did)) {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }

      await this.verifyStatus(did, verifyStatusOptions)

      const permissions = new ScopePermissionsTransition(scope?.split(' '))

      // Should never happen
      if (!permissions.scopes.has('atproto')) {
        throw new InvalidRequestError(
          'OAuth token does not have "atproto" scope',
          'InvalidToken',
        )
      }

      await authorize(permissions, ctx)

      return {
        credentials: {
          type: 'oauth',
          did,
          permissions,
        },
      }
    }
  }

  protected async verifyStatus(
    did: DidString,
    options: VerifiedOptions,
  ): Promise<void> {
    if (options.checkDeactivated || options.checkTakedown) {
      await this.findAccount(did, options)
    }
  }

  /**
   * Finds an account by its handle or DID, returning possibly deactivated or
   * taken down accounts (unless `options.checkDeactivated` or
   * `options.checkTakedown` are set to true, respectively).
   */
  public async findAccount(
    handleOrDid: AtIdentifierString,
    options: VerifiedOptions,
  ): Promise<ActorAccount> {
    const account = await this.accountManager.getAccount(handleOrDid, {
      includeDeactivated: true,
      includeTakenDown: true,
    })
    if (!account) {
      // will be turned into ExpiredToken for the client if proxied by entryway
      throw new ForbiddenError('Account not found', 'AccountNotFound')
    }
    if (options.checkTakedown && softDeleted(account)) {
      throw new AuthRequiredError(
        'Account has been taken down',
        'AccountTakedown',
      )
    }
    if (options.checkDeactivated && account.deactivatedAt) {
      throw new AuthRequiredError(
        'Account is deactivated',
        'AccountDeactivated',
      )
    }
    return account
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

    const { payload } = await jose
      .jwtVerify(token, this._jwtKey, options)
      .catch((cause) => {
        if (cause instanceof jose.errors.JWTExpired) {
          throw new InvalidRequestError('Token has expired', 'ExpiredToken', {
            cause,
          })
        } else {
          throw new InvalidRequestError(
            'Token could not be verified',
            'InvalidToken',
            { cause },
          )
        }
      })

    const { sub, aud, scope, lxm, cnf, jti } = payload

    if (typeof lxm !== 'undefined') {
      // Service auth tokens should never make it to here. But since service
      // auth tokens do not have a "typ" header, the "typ" check above will not
      // catch them. This check here is mainly to protect against the
      // hypothetical case in which a PDS would issue service auth tokens using
      // its private key.
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    if (typeof cnf !== 'undefined') {
      // Proof-of-Possession (PoP) tokens are not allowed here
      // https://www.rfc-editor.org/rfc/rfc7800.html
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    if (typeof sub !== 'string' || !isDidString(sub)) {
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
  }

  protected async verifyServiceJwt(
    req: IncomingMessage,
    opts?: { iss?: string[] },
  ) {
    const jwtStr = bearerTokenFromReq(req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }

    const nsid = parseReqNsid(req)
    const payload = await verifyServiceJwt(
      jwtStr,
      null,
      nsid,
      async (iss, forceRefresh) => {
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
      },
    )
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

  protected async verifyEntrywayServiceJwt(req: IncomingMessage) {
    const entrywayDid = this.dids.entryway
    const didKey = this._entrywayServiceAuth?.didKey
    if (!entrywayDid || !didKey) {
      throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
    }

    const jwtStr = bearerTokenFromReq(req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }

    // @NOTE Unlike this.verifyServiceJwt(), the key comes from config rather
    // than the issuer's DID document, and the entryway is not an accepted
    // audience: these tokens are minted for this PDS only.
    const payload = await verifyServiceJwt(
      jwtStr,
      this.dids.pds,
      parseReqNsid(req),
      async (iss) => {
        if (iss !== entrywayDid) {
          throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
        }
        return didKey
      },
    )

    // @NOTE xrpc-server's verifyJwt pins neither "alg" (an empty one skips its
    // algorithm check) nor "typ", and does not bound token lifetime; the
    // entryway token contract requires all three.
    const { alg, typ } = jose.decodeProtectedHeader(jwtStr)
    if (alg !== 'ES256K') {
      throw new AuthRequiredError(`Invalid jwt algorithm "${alg}"`, 'BadJwtAlg')
    }
    if (typ !== 'JWT') {
      throw new AuthRequiredError(`Invalid jwt type "${typ}"`, 'BadJwtType')
    }
    const { iat } = jose.decodeJwt(jwtStr)
    if (
      typeof iat !== 'number' ||
      iat > Date.now() / 1000 + ENTRYWAY_JWT_CLOCK_TOLERANCE_SEC
    ) {
      throw new AuthRequiredError('jwt iat is missing or invalid', 'BadJwtIat')
    }
    if (payload.exp - iat > ENTRYWAY_SERVICE_JWT_MAX_LIFETIME_SEC) {
      throw new AuthRequiredError('jwt lifetime is too long', 'BadJwtLifetime')
    }

    return payload
  }

  protected isEntrywayIssuedJwt(req: IncomingMessage): boolean {
    if (!this.dids.entryway || !this._entrywayServiceAuth) return false
    const token = bearerTokenFromReq(req)
    if (!token) return false
    try {
      return jose.decodeJwt(token).iss === this.dids.entryway
    } catch {
      // Malformed tokens are left to the fallback verifier to reject.
      return false
    }
  }

  /**
   * Whether the request carries a valid entryway service JWT for the called
   * method. Unlike the entryway verifiers, this never throws, so it can run on
   * any request before routing.
   */
  public async isEntrywayServiceRequest(
    req: IncomingMessage,
  ): Promise<boolean> {
    try {
      if (!this.isEntrywayIssuedJwt(req)) return false
      await this.verifyEntrywayServiceJwt(req)
      return true
    } catch {
      return false
    }
  }

  /**
   * Verifies the relay token that the entryway attaches to the user requests
   * it proxies, and returns the client IP address it attests to, in canonical
   * form.
   *
   * @throws {EntrywayRelayTokenError} if the token is not valid
   */
  public async verifyEntrywayRelayToken(token: string): Promise<string> {
    const entrywayDid = this.dids.entryway
    const key = this._entrywayServiceAuth?.keyObject
    if (!entrywayDid || !key) {
      throw new EntrywayRelayTokenError('not_configured')
    }

    // Every claim is checked on the decoded token before the signature, so a
    // stranger's junk header costs a parse, not a signature verification: the
    // middleware runs before the rate limiter, and anyone can send this header.
    let unverifiedHeader: jose.ProtectedHeaderParameters
    let unverifiedPayload: jose.JWTPayload
    try {
      unverifiedHeader = jose.decodeProtectedHeader(token)
      unverifiedPayload = jose.decodeJwt(token)
    } catch {
      throw new EntrywayRelayTokenError('malformed')
    }
    if (unverifiedHeader.alg !== 'ES256K') {
      throw new EntrywayRelayTokenError('bad_alg')
    }
    const ip = this.checkEntrywayRelayClaims(
      entrywayDid,
      unverifiedHeader,
      unverifiedPayload,
    )

    // @NOTE Verified with node:crypto rather than xrpc-server's verifyJwt (as
    // service JWTs are): the entryway sends one of these with every request it
    // proxies.
    await jose
      .jwtVerify(token, key, { algorithms: ['ES256K'] })
      .catch((err) => {
        throw new EntrywayRelayTokenError(
          err instanceof jose.errors.JWTExpired
            ? 'expired'
            : err instanceof jose.errors.JWSSignatureVerificationFailed
              ? 'bad_sig'
              : err instanceof jose.errors.JOSEAlgNotAllowed
                ? 'bad_alg'
                : 'malformed',
        )
      })

    return ip
  }

  // "typ" is pinned so that access tokens ("at+jwt") are refused, and "lxm" is
  // refused so that a relay token and a service JWT can never stand in for each
  // other. Returns the attested client IP in canonical form.
  private checkEntrywayRelayClaims(
    entrywayDid: string,
    protectedHeader: jose.ProtectedHeaderParameters,
    payload: jose.JWTPayload,
  ): string {
    if (protectedHeader.typ !== 'JWT') {
      throw new EntrywayRelayTokenError('bad_typ')
    }
    const { iss, aud, iat, exp, lxm, client_ip: clientIp } = payload
    if (iss !== entrywayDid) {
      throw new EntrywayRelayTokenError('wrong_iss')
    }
    if (aud !== this.dids.pds) {
      throw new EntrywayRelayTokenError('wrong_aud')
    }
    if (lxm !== undefined) {
      throw new EntrywayRelayTokenError('has_lxm')
    }
    if (
      typeof iat !== 'number' ||
      iat > Date.now() / 1000 + ENTRYWAY_JWT_CLOCK_TOLERANCE_SEC
    ) {
      throw new EntrywayRelayTokenError('bad_iat')
    }
    if (
      typeof exp !== 'number' ||
      exp - iat > ENTRYWAY_RELAY_TOKEN_MAX_LIFETIME_SEC
    ) {
      throw new EntrywayRelayTokenError('bad_lifetime')
    }
    const ip = typeof clientIp === 'string' ? canonicalIp(clientIp) : null
    if (!ip) {
      throw new EntrywayRelayTokenError('bad_client_ip')
    }
    return ip
  }

  protected assertEntrywayServiceAuthNotRequired(res: ServerResponse): void {
    if (this._entrywayServiceAuth?.required) {
      setAuthHeaders(res)
      throw new AuthRequiredError('Entryway service auth required')
    }
  }
}

// HELPERS
// ---------

export function isUserOrAdmin(
  auth: AccessOutput | OAuthOutput | AdminTokenOutput | UnauthenticatedOutput,
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
  req: IncomingMessage,
): [type: null] | [type: AuthType, token: string] => {
  const authorization = req.headers['authorization']
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

/**
 * @note Not all service auth tokens are guaranteed to have "lxm" claim, so this
 * function should not be used to verify service auth tokens. It is only used to
 * check if a token is definitely a service auth token.
 */
const isDefinitelyServiceAuth = (req: IncomingMessage): boolean => {
  const token = bearerTokenFromReq(req)
  if (!token) return false
  const payload = jose.decodeJwt(token)
  return payload['lxm'] != null
}

const extractAuthType = (req: IncomingMessage): AuthType | null => {
  const [type] = parseAuthorizationHeader(req)
  return type
}

export const bearerTokenFromReq = (req: IncomingMessage) => {
  const [type, token] = parseAuthorizationHeader(req)
  return type === AuthType.BEARER ? token : null
}

const parseBasicAuth = (
  req: IncomingMessage,
): { username: string; password: string } | null => {
  try {
    const [type, b64] = parseAuthorizationHeader(req)
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

export { type KeyObject }

export const createSecretKeyObject = (secret: string): KeyObject => {
  return createSecretKey(Buffer.from(secret))
}

export const createPublicKeyObject = (publicKeyHex: string): KeyObject => {
  // accepts compressed or uncompressed keys; validates the point is on-curve
  const point =
    secp256k1.ProjectivePoint.fromHex(publicKeyHex).toRawBytes(false)
  return createPublicKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'secp256k1',
      x: Buffer.from(point.subarray(1, 33)).toString('base64url'),
      y: Buffer.from(point.subarray(33, 65)).toString('base64url'),
    },
  })
}

function setAuthHeaders(res: ServerResponse) {
  res.setHeader('Cache-Control', 'private')
  appendVary(res, 'Authorization')
}
