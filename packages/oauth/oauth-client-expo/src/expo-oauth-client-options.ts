import type {
  OAuthClientMetadataInput,
  OAuthClientOptions,
  OAuthResponseMode,
} from '@atproto/oauth-client'

export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export type ExpoOAuthClientOptions = Simplify<
  {
    clientMetadata: Readonly<OAuthClientMetadataInput>
    responseMode?: Exclude<OAuthResponseMode, 'form_post'>
  } & Omit<
    OAuthClientOptions,
    | 'clientMetadata'
    | 'responseMode'
    | 'keyset'
    | 'runtimeImplementation'
    | 'sessionStore'
    | 'stateStore'
    | 'didCache'
    | 'handleCache'
    | 'dpopNonceCache'
    | 'authorizationServerMetadataCache'
    | 'protectedResourceMetadataCache'
  >
>
