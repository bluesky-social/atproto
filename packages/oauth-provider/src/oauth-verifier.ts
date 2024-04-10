import { Keyset, jwtSchema } from '@atproto/jwk'
import { AccessTokenType } from './access-token/access-token-type.js'
import { AccessToken } from './access-token/access-token.js'
import { DpopManager, DpopManagerOptions } from './dpop/dpop-manager.js'
import { DpopNonce } from './dpop/dpop-nonce.js'
import { InvalidDpopProofError } from './errors/invalid-dpop-proof-error.js'
import { InvalidTokenError } from './errors/invalid-token-error.js'
import { WWWAuthenticateError } from './errors/www-authenticate-error.js'
import { ReplayManager } from './replay/replay-manager.js'
import { ReplayStore } from './replay/replay-store.js'
import { Signer } from './signer/signer.js'
import { TokenType } from './token/token-type.js'
import {
  VerifyTokenClaimsOptions,
  VerifyTokenClaimsResult,
  verifyTokenClaims,
} from './token/verify-token-claims.js'
import { parseAuthorizationHeader } from './util/authorization-header.js'
import { Override } from './util/type.js'

export type OAuthVerifierOptions = Override<
  DpopManagerOptions,
  {
    /**
     * The "issuer" identifier of the OAuth provider, this is the base URL of the
     * OAuth provider.
     */
    issuer: URL | string

    /**
     * The keyset used to sign tokens. Note that OIDC requires that at least one
     * RS256 key is present in the keyset. ATPROTO requires ES256.
     */
    keyset: Keyset

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

    replayStore: ReplayStore
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
    issuer,
    keyset,
    replayStore,
    accessTokenType = AccessTokenType.jwt,

    ...dpopMgrOptions
  }: OAuthVerifierOptions) {
    const issuerUrl = new URL(String(issuer))
    if (issuerUrl.pathname !== '/' || issuerUrl.search || issuerUrl.hash) {
      throw new TypeError(
        '"issuer" must be an URL with no path, search or hash',
      )
    }

    this.issuer = issuerUrl.href
    this.keyset = keyset

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
    tokenType: TokenType,
    accessTokenType: AccessTokenType,
  ) {
    if (
      this.accessTokenType !== AccessTokenType.auto &&
      this.accessTokenType !== accessTokenType
    ) {
      throw new InvalidTokenError(tokenType, `Invalid token`)
    }
  }

  public async authenticateToken(
    tokenType: TokenType,
    token: AccessToken,
    dpopJkt: string | null,
    verifyOptions?: VerifyTokenClaimsOptions,
  ): Promise<VerifyTokenClaimsResult> {
    const jwt = jwtSchema.safeParse(token)
    if (!jwt.success) {
      throw new InvalidTokenError(tokenType, `Invalid token`)
    }

    this.assertTokenTypeAllowed(tokenType, AccessTokenType.jwt)

    const { payload } = await this.signer
      .verifyAccessToken(jwt.data)
      .catch((err) => {
        throw InvalidTokenError.from(err, tokenType)
      })

    return verifyTokenClaims(
      jwt.data,
      payload.jti,
      tokenType,
      dpopJkt,
      payload,
      verifyOptions,
    )
  }

  public async authenticateHttpRequest(
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
      if (err instanceof WWWAuthenticateError) throw err
      throw InvalidTokenError.from(err, tokenType)
    }
  }
}
