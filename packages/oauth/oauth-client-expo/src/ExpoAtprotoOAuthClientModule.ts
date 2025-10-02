import { NativeModule, requireNativeModule } from 'expo'
import { SignedJwt, VerifyOptions, VerifyResult } from '@atproto/oauth-client'
import { ExpoAtprotoOAuthClientModuleEvents } from './ExpoAtprotoOAuthClientModule.types'

export type NativeJwk = {
  kty: 'EC'
  crv: 'P-256'
  kid: string
  x: string
  y: string
  d: string
  alg: 'ES256'
}

declare class ExpoAtprotoOAuthClientModule extends NativeModule<ExpoAtprotoOAuthClientModuleEvents> {
  digest(data: Uint8Array, algo: string): Promise<Uint8Array>

  getRandomValues(byteLength: number): Promise<Uint8Array>

  generatePrivateJwk(algorithm: string): Promise<NativeJwk>

  createJwt(header: string, payload: string, jwk: NativeJwk): Promise<SignedJwt>

  verifyJwt<C extends string = never>(
    token: SignedJwt,
    jwk: NativeJwk,
    options: VerifyOptions<C>,
  ): Promise<VerifyResult<C>>
}

export default requireNativeModule<ExpoAtprotoOAuthClientModule>(
  'ExpoAtprotoOAuthClient',
)
