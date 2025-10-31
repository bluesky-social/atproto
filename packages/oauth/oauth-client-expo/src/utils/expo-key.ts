import {
  type Jwk,
  type JwtHeader,
  type JwtPayload,
  Key,
  type SignedJwt,
  type VerifyOptions,
  type VerifyResult,
} from '@atproto/oauth-client'
import type { NativeJwk } from '../ExpoAtprotoOAuthClientModule'
import { default as NativeModule } from '../ExpoAtprotoOAuthClientModule'

export type ExpoJwk = Jwk & NativeJwk & { key_ops: ['sign'] }
export class ExpoKey extends Key<ExpoJwk> {
  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<SignedJwt> {
    return NativeModule.createJwt(
      JSON.stringify(header),
      JSON.stringify(payload),
      toNativeJwk(this.jwk),
    )
  }

  async verifyJwt<C extends string = never>(
    token: SignedJwt,
    options: VerifyOptions<C> = {},
  ): Promise<VerifyResult<C>> {
    return NativeModule.verifyJwt(token, toNativeJwk(this.jwk), options)
  }

  static async generate(algs: string[]): Promise<ExpoKey> {
    if (algs.includes('ES256')) {
      const jwk = await NativeModule.generatePrivateJwk('ES256')
      return new ExpoKey({ ...jwk, key_ops: ['sign'] })
    }

    throw TypeError(`No supported algorithm found in: ${algs.join(', ')}`)
  }
}

function toNativeJwk(jwk: ExpoJwk): NativeJwk {
  return {
    kty: jwk.kty,
    crv: jwk.crv,
    kid: jwk.kid,
    x: jwk.x,
    y: jwk.y,
    d: jwk.d,
    alg: jwk.alg,
  }
}
