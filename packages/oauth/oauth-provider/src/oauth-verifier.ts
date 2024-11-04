import { Key, Keyset, isSignedJwt } from '@atproto/jwk'
import {
  OAuthAccessToken,
  OAuthTokenType,
  oauthIssuerIdentifierSchema,
} from '@atproto/oauth-types'
import type { Redis, RedisOptions } from 'ioredis'

import { AccessTokenType } from './access-token/access-token-type.js'
import { DpopManager, DpopManagerOptions } from './dpop/dpop-manager.js'
import { DpopNonce } from './dpop/dpop-nonce.js'
import { InvalidDpopProofError } from './errors/invalid-dpop-proof-error.js'
import { InvalidTokenError } from './errors/invalid-token-error.js'
import { UseDpopNonceError } from './errors/use-dpop-nonce-error.js'
import { WWWAuthenticateError } from './errors/www-authenticate-error.js'
import { parseAuthorizationHeader } from './lib/util/authorization-header.js'
import { Override } from './lib/util/type.js'
import { ReplayManager } from './replay/replay-manager.js'
import { ReplayStoreMemory } from './replay/replay-store-memory.js'
import { ReplayStoreRedis } from './replay/replay-store-redis.js'
import { ReplayStore } from './replay/replay-store.js'
import { Signer } from './signer/signer.js'
import {
  VerifyTokenClaimsOptions,
  VerifyTokenClaimsResult,
  verifyTokenClaims,
} from './token/verify-token-claims.js'

export type OAuthVerifierOptions = Override<
  DpopManagerOptions,
  {
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
     * If set to {@link AccessTokenType.jwt}, the provider will use JWTs for
     * access tokens. If set to {@link AccessTokenType.id}, the provider will
     * use tokenId as access tokens. If set to {@link AccessTokenType.auto},
     * JWTs will only be used if the audience is different from the issuer.
     * Defaults to {@link AccessTokenType.jwt}.
     *
     * Here is a comparison of the two types:
     *
     * - pro id: less CPU intensive (no crypto operations)
     * - pro id: less bandwidth (shorter tokens than jwt)
     * - pro id: token data is in sync with database (e.g. revocation)
     * - pro jwt: stateless: no I/O needed (no db lookups through token store)
     * - pro jwt: stateless: allows Resource Server to be on a different
     *   host/server
     */
    accessTokenType?: AccessTokenType

    /**
     * A redis instance to use for replay protection. If not provided, replay
     * protection will use memory storage.
     */
    redis?: Redis | RedisOptions | string

    replayStore?: ReplayStore
  }
>

export {
  AccessTokenType,
  DpopNonce,
  Keyset,
  type ReplayStore,
  type VerifyTokenClaimsOptions,
}

export class OAuthVerifier {
  public readonly issuer: string
  public readonly keyset: Keyset

  protected readonly accessTokenType: AccessTokenType
  protected readonly dpopManager: DpopManager
  protected readonly replayManager: ReplayManager
  protected readonly signer: Signer

  constructor({
    redis,
    issuer,
    keyset,
    replayStore = redis != null
      ? new ReplayStoreRedis({ redis })
      : new ReplayStoreMemory(),
    accessTokenType = AccessTokenType.jwt,

    ...dpopMgrOptions
  }: OAuthVerifierOptions) {
    const issuerParsed = oauthIssuerIdentifierSchema.parse(issuer)
    const issuerUrl = new URL(issuerParsed)

    // TODO (?) support issuer with path
    if (issuerUrl.pathname !== '/') {
      throw new TypeError(
        `"issuer" must be an URL with no path, search or hash (${issuerUrl})`,
      )
    }

    this.issuer = issuerParsed
    this.keyset = keyset instanceof Keyset ? keyset : new Keyset(keyset)

    this.accessTokenType = accessTokenType
    this.dpopManager = new DpopManager(dpopMgrOptions)
    this.replayManager = new ReplayManager(replayStore)
    this.signer = new Signer(this.issuer, this.keyset)
  }

  public nextDpopNonce() {
    return this.dpopManager.nextNonce()
  }

  public async checkDpopProof(
    proof: unknown,
    htm: string,
    htu: string | URL,
    accessToken?: string,
  ): Promise<string | null> {
    if (proof === undefined) return null

    const { payload, jkt } = await this.dpopManager.checkProof(
      proof,
      htm,
      htu,
      accessToken,
    )

    const unique = await this.replayManager.uniqueDpop(payload.jti)
    if (!unique) throw new InvalidDpopProofError('DPoP proof jti is not unique')

    return jkt
  }

  protected assertTokenTypeAllowed(
    tokenType: OAuthTokenType,
    accessTokenType: AccessTokenType,
  ) {
    if (
      this.accessTokenType !== AccessTokenType.auto &&
      this.accessTokenType !== accessTokenType
    ) {
      throw new InvalidTokenError(tokenType, `Invalid token type`)
    }
  }

  protected async authenticateToken(
    tokenType: OAuthTokenType,
    token: OAuthAccessToken,
    dpopJkt: string | null,
    verifyOptions?: VerifyTokenClaimsOptions,
  ): Promise<VerifyTokenClaimsResult> {
    if (!isSignedJwt(token)) {
      throw new InvalidTokenError(tokenType, `Malformed token`)
    }

    this.assertTokenTypeAllowed(tokenType, AccessTokenType.jwt)

    const { payload } = await this.signer
      .verifyAccessToken(token)
      .catch((err) => {
        throw InvalidTokenError.from(err, tokenType)
      })

    return verifyTokenClaims(
      token,
      payload.jti,
      tokenType,
      dpopJkt,
      payload,
      verifyOptions,
    )
  }

  public async authenticateRequest(
    method: string,
    url: URL,
    headers: {
      authorization?: string
      dpop?: unknown
    },
    verifyOptions?: VerifyTokenClaimsOptions,
  ): Promise<VerifyTokenClaimsResult> {
    const [tokenType, token] = parseAuthorizationHeader(headers.authorization)
    try {
      const dpopJkt = await this.checkDpopProof(
        headers.dpop,
        method,
        url,
        token,
      )

      if (tokenType === 'DPoP' && !dpopJkt) {
        throw new InvalidDpopProofError(`DPoP proof required`)
      }

      return await this.authenticateToken(
        tokenType,
        token,
        dpopJkt,
        verifyOptions,
      )
    } catch (err) {
      if (err instanceof UseDpopNonceError) throw err.toWwwAuthenticateError()
      if (err instanceof WWWAuthenticateError) throw err

      throw InvalidTokenError.from(err, tokenType)
    }
  }
}
