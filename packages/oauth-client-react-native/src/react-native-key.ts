import {
  Jwt,
  JwtHeader,
  JwtPayload,
  Key,
  VerifyOptions,
  VerifyPayload,
  VerifyResult,
  jwkValidator,
} from '@atproto/jwk'

import { OauthClientReactNative } from './oauth-client-react-native.js'

export class ReactNativeKey extends Key {
  static async generate(
    kid: string,
    allowedAlgos: string[],
  ): Promise<ReactNativeKey> {
    for (const algo of allowedAlgos) {
      try {
        // Note: OauthClientReactNative.generatePrivateJwk should throw if it
        // doesn't support the algorithm.
        const jwk = await OauthClientReactNative.generatePrivateJwk(algo)
        const use = jwk.use || 'sig'
        return new ReactNativeKey(jwkValidator.parse({ ...jwk, use, kid }))
      } catch {
        // Ignore, try next one
      }
    }

    throw new Error('No supported algorithms')
  }

  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<Jwt> {
    return OauthClientReactNative.createJwt(header, payload, this.jwk)
  }

  async verifyJwt<
    P extends VerifyPayload = JwtPayload,
    C extends string = string,
  >(token: Jwt, options?: VerifyOptions<C>): Promise<VerifyResult<P, C>> {
    const result = await OauthClientReactNative.verifyJwt(
      token,
      options,
      this.jwk,
    )

    // TODO (?): add any check not performed by the native module
    //  - result.payload.aud - must match options?.audience
    //  - result.payload.iss - must match options?.issuer
    //  - result.payload.sub - must match options?.subject
    //  - result.header.typ - must match options?.typ
    //  - result.payload - must contain all of options?.requiredClaims as keys
    //  - result.payload.iat - must be present
    //  - result.payload.iat - must not older than (options?.currentDate - options?.maxTokenAge +- options?.clockTolerance)
    //  - result.payload.nbf - if present (options?.currentDate +- options?.clockTolerance)
    //  - result.payload.exp - if present (options?.currentDate +- options?.clockTolerance)

    return result as VerifyResult<P, C>
  }
}
