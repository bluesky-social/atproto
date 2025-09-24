import {
  type JwtHeader,
  type JwtPayload,
  Key,
  type SignedJwt,
  type VerifyOptions,
  type VerifyResult,
} from '@atproto/oauth-client'
import type { NativeJwk } from '../ExpoAtprotoAuthModule'
import { default as NativeModule } from '../ExpoAtprotoAuthModule'

export class ExpoKey extends Key<NativeJwk> {
  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<SignedJwt> {
    return NativeModule.createJwt(
      JSON.stringify(header),
      JSON.stringify(payload),
      this.jwk,
    )
  }

  async verifyJwt<C extends string = never>(
    token: SignedJwt,
    options: VerifyOptions<C> = {},
  ): Promise<VerifyResult<C>> {
    return NativeModule.verifyJwt(token, this.jwk, options)
  }

  static async generate(algs: string[]): Promise<ExpoKey> {
    if (algs.includes('ES256')) {
      const jwk = await NativeModule.generatePrivateJwk('ES256')
      return new ExpoKey(jwk)
    }

    throw TypeError(`No supported algorithm found in: ${algs.join(', ')}`)
  }
}
