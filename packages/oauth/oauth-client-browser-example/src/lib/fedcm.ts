import { type DidString, isDidString } from '@atproto/lex'
import { clientMetadata } from '../oauthClient.ts'

const FEDCM_APP_STATE_PREFIX = 'fedcm:'

type FedcmCredential = Credential & {
  configURL?: unknown
  token?: unknown
}

type FedcmRequestOptions = CredentialRequestOptions & {
  identity: {
    mode: 'passive' | 'active'
    providers: {
      configURL: string
      clientId: string
      type?: string
      params: { response_type: 'id_token'; nonce: string }
    }[]
  }
}

type FedcmCredentialsContainer = {
  get(options: FedcmRequestOptions): Promise<Credential | null>
}

export type FedcmSelection = {
  configURL: string
  /** The `atproto-id+jwt` id token; unverified. */
  token: string
}

// @NOTE IdP registration: `configUrls` becomes unnecessary once registered
// IdPs are the only way to choose providers.
export type FedcmProviders = {
  configUrls: readonly string[]
  idpRegistration: boolean
}

const FEDCM_IDP_TYPE = 'https://atproto.com'

export function requestFedcmSelection(
  { configUrls, idpRegistration }: FedcmProviders,
  signal: AbortSignal,
  mode: 'passive' | 'active',
  nonce: string,
): Promise<FedcmSelection | null> {
  // The "any" registered-IdP entry counts as one provider.
  if (
    mode === 'active' &&
    configUrls.length + (idpRegistration ? 1 : 0) !== 1
  ) {
    throw new Error('Active FedCM requires exactly one provider.')
  }

  const ID_TOKEN_PARAMS = { response_type: 'id_token', nonce } as const
  const providers: FedcmRequestOptions['identity']['providers'] =
    configUrls.map((configURL) => ({
      configURL: new URL(configURL).href,
      clientId: clientMetadata.client_id,
      params: ID_TOKEN_PARAMS,
    }))
  if (idpRegistration) {
    // @NOTE IdP registration: the browser expands "any" to each registered IdP
    // whose config `types` contains this type.
    providers.push({
      configURL: 'any',
      type: FEDCM_IDP_TYPE,
      clientId: clientMetadata.client_id,
      params: ID_TOKEN_PARAMS,
    })
  }
  if (!providers.length) return Promise.resolve(null)
  if (typeof navigator === 'undefined' || !navigator.credentials?.get) {
    return Promise.resolve(null)
  }

  signal.throwIfAborted()
  // @NOTE Active mode must call this directly from a genuine click to preserve
  // the browser's transient user activation.
  return (navigator.credentials as FedcmCredentialsContainer)
    .get({
      mediation: 'required',
      signal,
      identity: {
        mode,
        providers,
      },
    })
    .then((credential) => {
      signal.throwIfAborted()
      if (!credential) return null

      const fedcmCredential = credential as FedcmCredential
      if (typeof fedcmCredential.configURL !== 'string') {
        throw new Error('FedCM did not return a provider configURL')
      }

      const configURL = new URL(fedcmCredential.configURL).href
      if (idpRegistration) {
        // @NOTE IdP registration: the picked IdP is any registered one, so its
        // config URL cannot be known up front. The OAuth `sub` check in
        // OAuthProvider.tsx is the real guard, but it does not stop a
        // malicious registered IdP from asserting its own DID: registration
        // is silent, so any site can register as `https://atproto.com` and
        // sign the user into an attacker's account. Accepted for the prototype.
        if (new URL(configURL).protocol !== 'https:') {
          throw new Error('FedCM returned a non-https provider configURL')
        }
      } else if (
        !providers.some((provider) => provider.configURL === configURL)
      ) {
        throw new Error('FedCM returned an unconfigured provider configURL')
      }

      if (typeof fedcmCredential.token !== 'string') {
        throw new Error('FedCM did not return an id token string')
      }

      return { configURL, token: fedcmCredential.token }
    })
}

export function createFedcmAppState(did: DidString): string {
  return `${FEDCM_APP_STATE_PREFIX}${did}`
}

export function readFedcmAppState(
  state: string | null | undefined,
): DidString | undefined {
  if (!state?.startsWith(FEDCM_APP_STATE_PREFIX)) return undefined
  const did = state.slice(FEDCM_APP_STATE_PREFIX.length)
  return isDidString(did) ? did : undefined
}
