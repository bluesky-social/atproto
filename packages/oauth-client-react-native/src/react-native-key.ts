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
    if (!allowedAlgos.includes('ES256')) {
      throw new Error(
        `None of the allowed algorithms (${allowedAlgos}) are supported (only ES256)`,
      )
    }

    const privateJwk: Jwk = await OauthClientReactNative.createES256Jwk()
    return new ReactNativeKey({ ...privateJwk, kid })
  }

  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<Jwt> {
    return OauthClientReactNative.createJwt(header, payload, this.jwk)
  }

  async verifyJwt<
    P extends VerifyPayload = JwtPayload,
    C extends string = string,
  >(token: Jwt, options?: VerifyOptions<C>): Promise<VerifyResult<P, C>> {
    return OauthClientReactNative.verifyJwt(token, options, this.jwk)
  }
}
