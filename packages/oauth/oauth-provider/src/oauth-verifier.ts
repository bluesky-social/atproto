import type { Redis, RedisOptions } from 'ioredis'
import { Key, Keyset, isSignedJwt } from '@atproto/jwk'
import {
  OAuthAccessToken,
  OAuthIssuerIdentifier,
  OAuthTokenType,
  oauthIssuerIdentifierSchema,
} from '@atproto/oauth-types'
import { DpopManager, DpopManagerOptions } from './dpop/dpop-manager.js'
import { DpopNonce } from './dpop/dpop-nonce.js'
import { DpopProof } from './dpop/dpop-proof.js'
import { InvalidDpopKeyBindingError } from './errors/invalid-dpop-key-binding-error.js'
import { InvalidDpopProofError } from './errors/invalid-dpop-proof-error.js'
import { InvalidTokenError } from './errors/invalid-token-error.js'
import { UseDpopNonceError } from './errors/use-dpop-nonce-error.js'
import { WWWAuthenticateError } from './errors/www-authenticate-error.js'
import { parseAuthorizationHeader } from './lib/util/authorization-header.js'
import { includedIn } from './lib/util/function.js'
import { OAuthHooks } from './oauth-hooks.js'
import { ReplayManager } from './replay/replay-manager.js'
import { ReplayStoreMemory } from './replay/replay-store-memory.js'
import { ReplayStoreRedis } from './replay/replay-store-redis.js'
import { ReplayStore } from './replay/replay-store.js'
import { AccessTokenPayload } from './signer/access-token-payload.js'
import { Signer } from './signer/signer.js'

export type DecodeTokenHook = OAuthHooks['onDecodeToken']

export type OAuthVerifierOptions = DpopManagerOptions & {
  /**
   * The "issuer" identifier of the OAuth provider, this is the base URL of the
   * OAuth provider.
   */
  issuer: URL | string

  /**
   * The keyset used to sign access tokens.
   */
  keyset: Keyset | Iterable<Key | undefined | null | false>

  /**
   * A redis instance to use for replay protection. If not provided, replay
   * protection will use memory storage.
   */
  redis?: Redis | RedisOptions | string

  replayStore?: ReplayStore

  onDecodeToken?: DecodeTokenHook
}

export type VerifyTokenPayloadOptions = {
  /** One of these audience must be included in the token audience(s) */
  audience?: [string, ...string[]]
  /** One of these scope must be included in the token scope(s) */
  scope?: [string, ...string[]]
}

export { DpopNonce, Key, Keyset }
export type {
  AccessTokenPayload,
  DpopProof,
  OAuthTokenType,
  RedisOptions,
  ReplayStore,
}

export class OAuthVerifier {
  private readonly onDecodeToken?: DecodeTokenHook

  public readonly issuer: OAuthIssuerIdentifier
  public readonly keyset: Keyset

  public readonly dpopManager: DpopManager
  public readonly replayManager: ReplayManager
  public readonly signer: Signer

  constructor({
    redis,
    issuer,
    keyset,
    replayStore = redis != null
      ? new ReplayStoreRedis({ redis })
      : new ReplayStoreMemory(),
    onDecodeToken,

    ...rest
  }: OAuthVerifierOptions) {
    const dpopMgrOptions: DpopManagerOptions = rest

    const issuerParsed = oauthIssuerIdentifierSchema.parse(issuer)
    const issuerUrl = new URL(issuerParsed)

    // @TODO (?) support issuer with path
    if (issuerUrl.pathname !== '/') {
      throw new TypeError(
        `"issuer" must be an URL with no path, search or hash (${issuerUrl})`,
      )
    }

    this.issuer = issuerParsed
    this.keyset = keyset instanceof Keyset ? keyset : new Keyset(keyset)

    this.dpopManager = new DpopManager(dpopMgrOptions)
    this.replayManager = new ReplayManager(replayStore)
    this.signer = new Signer(this.issuer, this.keyset)

    this.onDecodeToken = onDecodeToken
  }

  public nextDpopNonce() {
    return this.dpopManager.nextNonce()
  }

  public async checkDpopProof(
    httpMethod: string,
    httpUrl: Readonly<URL>,
    httpHeaders: Record<string, undefined | string | string[]>,
    accessToken?: string,
  ): Promise<null | DpopProof> {
    const dpopProof = await this.dpopManager.checkProof(
      httpMethod,
      httpUrl,
      httpHeaders,
      accessToken,
    )

    if (dpopProof) {
      const unique = await this.replayManager.uniqueDpop(dpopProof.jti)
      if (!unique) throw new InvalidDpopProofError('DPoP proof replayed')
    }

    return dpopProof
  }

  protected async decodeToken(
    tokenType: OAuthTokenType,
    token: OAuthAccessToken,
    dpopProof: null | DpopProof,
  ): Promise<AccessTokenPayload> {
    if (!isSignedJwt(token)) {
      throw new InvalidTokenError(tokenType, `Malformed token`)
    }

    const { payload } = await this.signer
      .verifyAccessToken(token)
      .catch((err) => {
        throw InvalidTokenError.from(err, tokenType)
      })

    if (payload.cnf?.jkt) {
      // An access token with a cnf.jkt claim must be a DPoP token
      if (tokenType !== 'DPoP') {
        throw new InvalidTokenError(
          'DPoP',
          `Access token is bound to a DPoP proof, but token type is ${tokenType}`,
        )
      }

      // DPoP token type must be used with a DPoP proof
      if (!dpopProof) {
        throw new InvalidDpopProofError(`DPoP proof required`)
      }

      // DPoP proof must be signed with the key that matches the "cnf" claim
      if (payload.cnf.jkt !== dpopProof.jkt) {
        throw new InvalidDpopKeyBindingError()
      }
    } else {
      // An access token without a cnf.jkt claim must be a Bearer token
      if (tokenType !== 'Bearer') {
        throw new InvalidTokenError(
          'Bearer',
          `Bearer token type must be used without a DPoP proof`,
        )
      }

      // @NOTE We ignore (but allow) DPoP proofs for Bearer tokens
    }

    const payloadOverride = await this.onDecodeToken?.call(null, {
      tokenType,
      token,
      payload,
      dpopProof,
    })

    return payloadOverride ?? payload
  }

  /**
   * @throws {WWWAuthenticateError}
   * @throws {InvalidTokenError}
   */
  public async authenticateRequest(
    httpMethod: string,
    httpUrl: Readonly<URL>,
    httpHeaders: Record<string, undefined | string | string[]>,
    verifyOptions?: VerifyTokenPayloadOptions,
  ): Promise<AccessTokenPayload> {
    const [tokenType, token] = parseAuthorizationHeader(
      httpHeaders['authorization'],
    )
    try {
      const dpopProof = await this.checkDpopProof(
        httpMethod,
        httpUrl,
        httpHeaders,
        token,
      )

      const tokenPayload = await this.decodeToken(tokenType, token, dpopProof)

      this.verifyTokenPayload(tokenType, tokenPayload, verifyOptions)

      return tokenPayload
    } catch (err) {
      if (err instanceof UseDpopNonceError) throw err.toWwwAuthenticateError()
      if (err instanceof WWWAuthenticateError) throw err

      throw InvalidTokenError.from(err, tokenType)
    }
  }

  protected verifyTokenPayload(
    tokenType: OAuthTokenType,
    tokenPayload: AccessTokenPayload,
    options?: VerifyTokenPayloadOptions,
  ): void {
    if (options?.audience) {
      const { aud } = tokenPayload
      const hasMatch =
        aud != null &&
        (Array.isArray(aud)
          ? options.audience.some(includedIn, aud)
          : options.audience.includes(aud))
      if (!hasMatch) {
        const details = `(got: ${aud}, expected one of: ${options.audience})`
        throw new InvalidTokenError(tokenType, `Invalid audience ${details}`)
      }
    }

    if (options?.scope) {
      const { scope } = tokenPayload
      const scopes = scope?.split(' ')
      if (!scopes || !options.scope.some(includedIn, scopes)) {
        const details = `(got: ${scope}, expected one of: ${options.scope})`
        throw new InvalidTokenError(tokenType, `Invalid scope ${details}`)
      }
    }

    if (tokenPayload.exp != null && tokenPayload.exp * 1000 <= Date.now()) {
      const expirationDate = new Date(tokenPayload.exp * 1000).toISOString()
      throw new InvalidTokenError(
        tokenType,
        `Token expired at ${expirationDate}`,
      )
    }
  }
}
