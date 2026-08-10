import { KeyObject, createPublicKey, createSecretKey } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'
import * as jose from 'jose'
import KeyEncoderModule from 'key-encoder'
import { getVerificationMaterial } from '@atproto/common'
import { IdResolver, getDidKeyFromMultibase } from '@atproto/identity'
import { AtIdentifierString, DidString, isDidString } from '@atproto/lex'
import {
  OAuthError,
  OAuthVerifier,
  VerifyTokenPayloadOptions,
  WWWAuthenticateError,
} from '@atproto/oauth-provider'
import {
  ScopePermissions,
  ScopePermissionsTransition,
} from '@atproto/oauth-scopes'
import {
  DpopProofError,
  SPACE_TOKEN_TYPES,
  SpaceTokenError,
  SpaceTokenType,
  spaceHostAud,
  verifyDpopProof,
  verifySpaceToken,
} from '@atproto/space'
import { SpaceRef } from '@atproto/syntax'
import {
  AuthRequiredError,
  Awaitable,
  ForbiddenError,
  InvalidRequestError,
  MethodAuthContext,
  MethodAuthVerifier,
  Params,
  XRPCError,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import { AccountManager } from './account-manager/account-manager.js'
import { ActorAccount } from './account-manager/helpers/account.js'
import {
  AccessOutput,
  AdminTokenOutput,
  DelegationTokenOutput,
  ModServiceOutput,
  OAuthOutput,
  RefreshOutput,
  ServiceAuthOutput,
  SpaceCredentialOutput,
  UnauthenticatedOutput,
  UserServiceAuthOutput,
} from './auth-output.js'
import { ACCESS_STANDARD, AuthScope, isAuthScope } from './auth-scope.js'
import { softDeleted } from './db/index.js'
import { appendVary } from './util/http.js'
import { WithRequired } from './util/types.js'

// key-encoder is CJS with exports.default; Node ESM interop wraps it as { default: Class }
const KeyEncoder = ((m) => m.default ?? m)(KeyEncoderModule)

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

  public moderator: MethodAuthVerifier<AdminTokenOutput | ModServiceOutput> =
    async (ctx) => {
      const type = extractAuthType(ctx.req)
      if (type === AuthType.BEARER) {
        return this.modService(ctx)
      } else {
        return this.adminToken(ctx)
      }
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

  /**
   * Service auth for methods whose audience only the handler can derive. It is
   * the handler's job to check {@link ServiceAuthOutput.aud}.
   */
  public serviceAuth: MethodAuthVerifier<ServiceAuthOutput> = async (ctx) => {
    setAuthHeaders(ctx.res)
    const nsid = parseReqNsid(ctx.req)
    const payload = await this.verifyServiceJwt(ctx.req, { audience: null })
    return {
      credentials: {
        type: 'service_auth',
        iss: payload.iss,
        aud: payload.aud,
        lxm: nsid,
      },
    }
  }

  /**
   * A space credential, presented under the `DPoP` scheme with a proof.
   *
   * One credential is reused across every repo host in the space, so it carries no
   * aud; the DPoP proof names this host instead. Handlers confirm the credential's
   * space matches theirs.
   */
  public spaceCredentialAuth: MethodAuthVerifier<SpaceCredentialOutput> =
    async (ctx) => {
      setAuthHeaders(ctx.res)

      const credential = spaceCredentialFromReq(ctx.req)
      const { payload } = await this.verifySpaceToken(credential, 'credential')
      const space = parseSpaceSub(payload.sub)

      // Only the space's own authority may issue credentials for it. Without this,
      // any DID could sign a credential naming someone else's space and have it
      // verified against its own signing key.
      if (payload.iss !== space.spaceDid) {
        throw new AuthRequiredError(
          'space credential issuer is not the space authority',
          'BadJwtIss',
        )
      }

      // Unreachable unless parseSpaceToken's own check is relaxed, but an unbound
      // credential must never fall through as a bearer token for the whole space.
      const jkt = payload.cnf?.jkt
      if (!jkt) {
        throw new AuthRequiredError(
          'space credential is not bound to a key',
          'BadJwtCnf',
        )
      }

      await this.verifySpaceDpopProof(ctx.req, credential, jkt)

      return {
        credentials: {
          type: 'space_credential',
          iss: space.spaceDid,
          space: space.toString(),
        },
      }
    }

  private async verifySpaceDpopProof(
    req: MethodAuthContext['req'],
    credential: string,
    jkt: string,
  ): Promise<void> {
    const proof = req.headers['dpop']
    if (typeof proof !== 'string' || !proof) {
      throw new AuthRequiredError(
        'space credential requires a DPoP proof',
        'MissingDpopProof',
      )
    }

    const url = new URL(req.originalUrl || req.url || '/', this._publicUrl)
    const { jti } = await verifyDpopProof(proof, {
      htm: req.method || 'GET',
      htu: url.toString(),
      credential,
      jkt,
    }).catch((err) => {
      if (err instanceof DpopProofError) {
        throw new AuthRequiredError(err.message, err.code)
      }
      throw err
    })

    // Shared with the OAuth DPoP path, whose retention (minutes) comfortably exceeds
    // MAX_PROOF_AGE_SEC + CLOCK_SKEW_SEC, so a still-valid proof is still remembered.
    const unique = await this.oauthVerifier.replayManager.uniqueDpop(jti)
    if (!unique) {
      throw new AuthRequiredError('DPoP proof replayed', 'BadDpopProof')
    }
  }

  /**
   * A delegation token, minted by a user's PDS and presented to this service (as
   * a space authority) in exchange for a space credential.
   *
   * Addressed to this authority's space host, and checked as such: a token minted
   * for another authority is rejected rather than honoured.
   */
  public delegationTokenAuth: MethodAuthVerifier<DelegationTokenOutput> =
    async (ctx) => {
      setAuthHeaders(ctx.res)

      const token = bearerTokenFromReq(ctx.req)
      if (!token) {
        throw new AuthRequiredError('missing delegation token', 'MissingJwt')
      }
      const { payload } = await this.verifySpaceToken(token, 'delegation')
      const space = parseSpaceSub(payload.sub)

      // We answer for many authorities, so there's no one fixed audience: derive it
      // from `sub` so a token minted for one authority can't be used at another.
      if (payload.aud !== spaceHostAud(space.spaceDid)) {
        throw new AuthRequiredError(
          'delegation token audience does not match the space authority',
          'BadJwtAudience',
        )
      }

      if (!isDidString(payload.iss)) {
        throw new AuthRequiredError(
          'delegation token issuer is not a DID',
          'BadJwtIss',
        )
      }

      return {
        credentials: {
          type: 'delegation_token',
          userDid: payload.iss,
          space: space.toString(),
        },
      }
    }

  private async verifySpaceToken(jwtStr: string, type: SpaceTokenType) {
    try {
      return await verifySpaceToken(type, jwtStr, {
        getSigningKey: (iss, kid, forceRefresh) =>
          this.resolveSpaceKey(iss, kid, forceRefresh),
      })
    } catch (err) {
      if (err instanceof AuthRequiredError) throw err
      if (err instanceof SpaceTokenError) {
        throw new AuthRequiredError(err.message, err.code)
      }
      throw new AuthRequiredError(
        `Invalid ${type} token: ${err instanceof Error ? err.message : String(err)}`,
        'BadJwt',
      )
    }
  }

  private async resolveSpaceKey(
    iss: string,
    kid: string | undefined,
    forceRefresh: boolean,
  ): Promise<string> {
    if (!kid) {
      throw new AuthRequiredError('missing token "kid"', 'BadJwt')
    }
    const keyId = kid.replace(/^#/, '')
    if (keyId !== 'atproto' && keyId !== 'atproto_space') {
      throw new AuthRequiredError(
        `unsupported space token "kid": ${kid}`,
        'BadJwt',
      )
    }

    const didDoc = await this.idResolver.did.resolve(iss, forceRefresh)
    if (!didDoc) {
      throw new AuthRequiredError(`could not resolve DID: ${iss}`, 'BadJwtIss')
    }
    const material = getVerificationMaterial(didDoc, keyId)
    const didKey = material && getDidKeyFromMultibase(material)
    if (!didKey) {
      throw new AuthRequiredError(
        `missing or bad key (#${keyId}) in did doc: ${iss}`,
        'BadJwtIss',
      )
    }
    return didKey
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

  public authorizationOrSpaceCredential<P extends Params>(
    options: VerifiedOptions &
      ScopedOptions &
      ExtraScopedOptions &
      AuthorizedOptions<P>,
  ): MethodAuthVerifier<SpaceCredentialOutput | OAuthOutput | AccessOutput, P> {
    const authorizationVerifier = this.authorization(options)
    return async (ctx) => {
      if (isSpaceCredentialAuth(ctx.req)) {
        return this.spaceCredentialAuth(ctx)
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

  /** `audience: null` leaves the audience for the caller to check. */
  protected async verifyServiceJwt(
    req: IncomingMessage,
    opts?: { iss?: string[]; audience?: null },
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
      opts?.audience !== null &&
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

// Space credentials share the `DPoP` scheme with OAuth access tokens, so they are
// told apart by an unverified `typ` header. Safe because this only routes: neither
// token type verifies as the other.
const isSpaceCredentialAuth = (req: IncomingMessage): boolean => {
  const token = spaceCredentialTokenFromReq(req)
  if (!token) return false
  try {
    const header = jose.decodeProtectedHeader(token)
    return header.typ === SPACE_TOKEN_TYPES.credential.typ
  } catch {
    return false
  }
}

const spaceCredentialTokenFromReq = (req: IncomingMessage): string | null => {
  const [type, token] = parseAuthorizationHeader(req)
  return type === AuthType.DPOP ? token : null
}

const spaceCredentialFromReq = (req: IncomingMessage): string => {
  const token = spaceCredentialTokenFromReq(req)
  if (!token) {
    throw new AuthRequiredError('missing space credential', 'MissingJwt')
  }
  return token
}

const parseSpaceSub = (sub: string): SpaceRef => {
  try {
    return SpaceRef.parse(sub)
  } catch {
    throw new AuthRequiredError(
      `space token subject is not a space URI: ${sub}`,
      'BadJwtSub',
    )
  }
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
