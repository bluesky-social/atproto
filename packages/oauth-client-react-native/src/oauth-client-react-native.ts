import { Jwk, Jwt } from '@atproto/jwk'
import { NativeModules, Platform } from 'react-native'

const LINKING_ERROR =
  `The package 'oauth-client-react-native' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n'

type Awaitable<T> = T | Promise<T>

// This is a stub for the native module. It is used when the module is not
// linked AND to provide types.
export const OauthClientReactNative =
  (NativeModules.OauthClientReactNative as null) || {
    getRandomValues(_length: number): Awaitable<Uint8Array> {
      throw new Error(LINKING_ERROR)
    },

    digest(_bytes: Uint8Array, _algorithm: string): Awaitable<Uint8Array> {
      throw new Error(LINKING_ERROR)
    },

    generatePrivateJwk(_algo: string): Awaitable<Jwk> {
      throw new Error(LINKING_ERROR)
    },

    createJwt(
      _header: unknown,
      _payload: unknown,
      _jwk: unknown,
    ): Awaitable<Jwt> {
      throw new Error(LINKING_ERROR)
    },

    verifyJwt(
      _token: Jwt,
      _jwk: Jwk,
    ): Awaitable<{
      payload: Record<string, unknown>
      protectedHeader: Record<string, unknown>
    }> {
      throw new Error(LINKING_ERROR)
    },
  }
