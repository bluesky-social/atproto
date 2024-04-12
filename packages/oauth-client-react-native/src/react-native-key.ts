import {
  Jwk,
  Jwt,
  JwtHeader,
  JwtPayload,
  Key,
  VerifyOptions,
  VerifyPayload,
  VerifyResult,
} from '@atproto/jwk'

import { OauthClientReactNative } from './oauth-client-react-native.js'

export class ReactNativeKey extends Key {
  static async generate(
    kid: string,
    allowedAlgos: string[] = ['ES256'],
  ): Promise<ReactNativeKey> {
    // Note: OauthClientReactNative.createJwk should throw if it supports none
    // of the allowed algorithms
    const privateJwk: Jwk = await OauthClientReactNative.createJwk(allowedAlgos)
    return new ReactNativeKey({ ...privateJwk, kid })
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
