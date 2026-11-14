import type { P256Keypair } from '@atproto/crypto'
import {
  SpaceTokenError,
  createSpaceSigHeaders,
  parseSpaceToken,
} from '@atproto/space'
import type { DidString } from '@atproto/syntax'

// Renew this long before expiry, capped at half the credential's lifetime.
const RENEWAL_MARGIN_SEC = 60

/**
 * A space credential, together with the key it is bound to (its `cnf.kid`).
 */
export class SpaceCredential {
  readonly #headers = new Map<DidString, Promise<Record<string, string>>>()

  private constructor(
    readonly token: string,
    readonly key: P256Keypair,
    /** Unix time (seconds) after which the credential should be renewed. */
    readonly renewAt: number,
    /**
     * The space's revision when the credential was issued, or `undefined` if
     * the space had no update yet. A syncer that last saw an earlier revision
     * has missed updates, and can catch up with `listWriters`.
     */
    readonly spaceRev?: string,
  ) {}

  /**
   * @throws {SpaceTokenError} if `token` is not a space credential bound to `key`
   */
  static parse(
    token: string,
    key: P256Keypair,
    { spaceRev }: { spaceRev?: string } = {},
  ): SpaceCredential {
    const { payload } = parseSpaceToken('credential', token)
    if (payload.cnf?.kid !== key.did()) {
      throw new SpaceTokenError(
        'space credential is not bound to the requested key',
        'BadJwtCnf',
      )
    }
    const margin = Math.min(RENEWAL_MARGIN_SEC, (payload.exp - payload.iat) / 2)
    return new SpaceCredential(token, key, payload.exp - margin, spaceRev)
  }

  get needsRenewal(): boolean {
    return Date.now() / 1e3 >= this.renewAt
  }

  /**
   * The headers presenting this credential to `audience`: the repo owner's DID
   * for repo methods, the space authority's DID for space host methods.
   *
   * @note The signature covers only the credential and the audience, so the
   * headers are computed once per audience and reused.
   */
  async headers(audience: DidString): Promise<Record<string, string>> {
    let headersPromise = this.#headers.get(audience)
    if (!headersPromise) {
      const promise = createSpaceSigHeaders({
        authorization: `Atproto-Space-Credential ${this.token}`,
        audience,
        keypair: this.key,
      }).then(({ headers }) => headers)
      this.#headers.set(audience, promise)
      // Don't keep a failure, so that the next request tries again.
      promise.catch(() => {
        if (this.#headers.get(audience) === promise) {
          this.#headers.delete(audience)
        }
      })
      headersPromise = promise
    }
    return headersPromise
  }
}
