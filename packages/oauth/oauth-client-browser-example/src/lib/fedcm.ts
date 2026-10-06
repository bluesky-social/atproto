import { type DidString, isDidString } from '@atproto/lex'
import { clientMetadata } from '../oauthClient.ts'

const FEDCM_APP_STATE_PREFIX = 'fedcm:'

type FedcmCredential = Credential & {
  configURL?: unknown
  token?: unknown
}

type FedcmRequestOptions = CredentialRequestOptions & {
  identity: {
    mode: 'passive'
    providers: { configURL: string; clientId: string }[]
  }
}

type FedcmCredentialsContainer = {
  get(options: FedcmRequestOptions): Promise<Credential | null>
}

export type FedcmSelection = {
  configURL: string
  did: DidString
}

export async function requestFedcmSelection(
  providerConfigUrls: readonly string[],
  signal: AbortSignal,
): Promise<FedcmSelection | null> {
  const providers = providerConfigUrls.map((configURL) => ({
    configURL: new URL(configURL).href,
    clientId: clientMetadata.client_id,
  }))
  if (!providers.length) return null
  if (typeof navigator === 'undefined' || !navigator.credentials?.get) {
    return null
  }

  signal.throwIfAborted()
  const credential = await (
    navigator.credentials as FedcmCredentialsContainer
  ).get({
    mediation: 'required',
    signal,
    identity: {
      mode: 'passive',
      providers,
    },
  })
  signal.throwIfAborted()
  if (!credential) return null

  const fedcmCredential = credential as FedcmCredential
  if (typeof fedcmCredential.configURL !== 'string') {
    throw new Error('FedCM did not return a provider configURL')
  }

  const configURL = new URL(fedcmCredential.configURL).href
  if (!providers.some((provider) => provider.configURL === configURL)) {
    throw new Error('FedCM returned an unconfigured provider configURL')
  }

  if (!isDidString(fedcmCredential.token)) {
    throw new Error('FedCM returned an invalid DID token')
  }

  return { configURL, did: fedcmCredential.token }
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
