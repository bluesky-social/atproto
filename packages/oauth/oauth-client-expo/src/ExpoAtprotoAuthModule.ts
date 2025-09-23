import { NativeModule, requireNativeModule } from 'expo'
import { VerifyOptions, VerifyResult } from '@atproto/oauth-client'
import { ExpoAtprotoAuthModuleEvents } from './ExpoAtprotoAuthModule.types'

export type NativeJwk = {
  kty: 'EC'
  use: 'sig' | 'enc' | undefined
  crv: 'P-256'
  kid: string
  x: string
  y: string
  d: string
  alg: string
}

declare class ExpoAtprotoOAuthClientModule extends NativeModule<ExpoAtprotoAuthModuleEvents> {
  digest(data: Uint8Array, algo: string): Uint8Array

  getRandomValues(byteLength: number): Uint8Array

  generatePrivateJwk(algorithim: string): NativeJwk

  createJwt(
    header: string,
    payload: string,
    jwk: NativeJwk,
  ): `${string}.${string}.${string}`

  verifyJwt<C extends string = never>(
    token: string,
    jwk: NativeJwk,
    options: VerifyOptions<C>,
  ): VerifyResult<C>
}

export default requireNativeModule<ExpoAtprotoOAuthClientModule>(
  'ExpoAtprotoOAuthClient',
)
