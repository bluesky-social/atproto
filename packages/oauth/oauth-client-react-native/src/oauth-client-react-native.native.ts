import { SimpleStore } from '@atproto-labs/simple-store'
import { jwkValidator } from '@atproto/jwk'
import {
  InternalStateData,
  OAuthClient,
  OAuthClientFetchMetadataOptions,
  OAuthClientOptions,
  OAuthSession,
  Session,
  SessionStore,
  StateStore,
} from '@atproto/oauth-client'
import { JWK } from 'jose'
import QuickCrypto from 'react-native-quick-crypto'
import {
  CryptoKey,
  SubtleAlgorithm,
} from 'react-native-quick-crypto/lib/typescript/src/keys'
import { JoseKey } from '../../jwk-jose/dist'
import { JoseKeyStore, SQLiteKVStore } from './sqlite-keystore'

export type ReactNativeOAuthClientOptions = Omit<
  OAuthClientOptions,
  // Provided by this lib
  | 'runtimeImplementation'
  // Provided by this lib but can be overridden
  | 'sessionStore'
  | 'stateStore'
> & {
  sessionStore?: SessionStore
  stateStore?: StateStore
  didStore?: SimpleStore<string, string>
}

export type ReactNativeOAuthClientFromMetadataOptions =
  OAuthClientFetchMetadataOptions &
    Omit<ReactNativeOAuthClientOptions, 'clientMetadata'>

export class ReactNativeOAuthClient extends OAuthClient {
  didStore: SimpleStore<string, string>

  static async fromClientId(
    options: ReactNativeOAuthClientFromMetadataOptions,
  ) {
    const clientMetadata = await OAuthClient.fetchMetadata(options)
    return new ReactNativeOAuthClient({ ...options, clientMetadata })
  }

  constructor({
    fetch,
    responseMode = 'query',

    ...options
  }: ReactNativeOAuthClientOptions) {
    if (!options.stateStore) {
      options.stateStore = new JoseKeyStore<InternalStateData>(
        new SQLiteKVStore('state'),
      )
    }
    if (!options.sessionStore) {
      options.sessionStore = new JoseKeyStore<Session>(
        new SQLiteKVStore('session'),
      )
    }
    if (!options.didStore) {
      options.didStore = new SQLiteKVStore('did')
    }
    super({
      ...options,

      sessionStore: options.sessionStore,
      stateStore: options.stateStore,
      fetch,
      responseMode,
      runtimeImplementation: {
        createKey: async (algs): Promise<JoseKey> => {
          const errors: unknown[] = []
          for (const alg of algs) {
            try {
              let subtle = QuickCrypto?.webcrypto?.subtle
              const subalg = toSubtleAlgorithm(alg)
              const keyPair = (await subtle.generateKey(subalg, true, [
                'sign',
                'verify',
              ])) as CryptoKeyPair

              const ex = (await subtle.exportKey(
                'jwk',
                keyPair.privateKey as unknown as CryptoKey,
              )) as JWK
              ex.alg = alg

              // RNQC doesn't give us a kid, so let's do a quick hash of the key
              const kid = QuickCrypto.createHash('sha256')
                .update(JSON.stringify(ex))
                .digest('hex')
              const use = 'sig'

              return new JoseKey(jwkValidator.parse({ ...ex, kid, use }))
            } catch (err) {
              errors.push(err)
            }
          }
          throw new AggregateError(errors, 'None of the algorithms worked')
        },
        getRandomValues: (length) =>
          new Uint8Array(QuickCrypto.randomBytes(length)),
        digest: (bytes, algorithm) =>
          QuickCrypto.createHash(algorithm.name).update(bytes).digest(),
      },
      clientMetadata: options.clientMetadata,
    })
    this.didStore = options.didStore
  }

  async init(refresh?: boolean) {
    const sub = await this.didStore.get(`(sub)`)
    if (sub) {
      try {
        const session = await this.restore(sub, refresh)
        return { session }
      } catch (err) {
        this.didStore.del(`(sub)`)
        throw err
      }
    }
  }

  async callback(params: URLSearchParams): Promise<{
    session: OAuthSession
    state: string | null
  }> {
    const { session, state } = await super.callback(params)
    await this.didStore.set(`(sub)`, session.sub)
    return { session, state }
  }
}

export function toSubtleAlgorithm(
  alg: string,
  crv?: string,
  options?: { modulusLength?: number },
): SubtleAlgorithm {
  switch (alg) {
    case 'PS256':
    case 'PS384':
    case 'PS512':
      return {
        name: 'RSA-PSS',
        hash: `SHA-${alg.slice(-3) as '256' | '384' | '512'}`,
        modulusLength: options?.modulusLength ?? 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      }
    case 'RS256':
    case 'RS384':
    case 'RS512':
      return {
        name: 'RSASSA-PKCS1-v1_5',
        hash: `SHA-${alg.slice(-3) as '256' | '384' | '512'}`,
        modulusLength: options?.modulusLength ?? 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      }
    case 'ES256':
    case 'ES384':
      return {
        name: 'ECDSA',
        namedCurve: `P-${alg.slice(-3) as '256' | '384'}`,
      }
    case 'ES512':
      return {
        name: 'ECDSA',
        namedCurve: 'P-521',
      }
    default:
      // https://github.com/w3c/webcrypto/issues/82#issuecomment-849856773

      throw new TypeError(`Unsupported alg "${alg}"`)
  }
}
