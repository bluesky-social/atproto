import { z } from 'zod'
import { DidDocument, DidService } from './did-document.js'
import { DidError, InvalidDidError } from './did-error.js'
import { Did } from './did.js'
import { canParse, isFragment } from './lib/uri.js'
import {
  DID_PLC_PREFIX,
  DID_WEB_PREFIX,
  assertDidPlc,
  assertDidWeb,
  isDidPlc,
  isDidWeb,
} from './methods.js'
import { Identifier, matchesIdentifier } from './utils.js'

// This file contains atproto-specific DID validation utilities.

export type AtprotoIdentityDidMethods = 'plc' | 'web'
export type AtprotoDid = Did<AtprotoIdentityDidMethods>
export type AtprotoDidDocument = DidDocument<AtprotoIdentityDidMethods>

export const atprotoDidSchema = z
  .string()
  .refine(isAtprotoDid, `Atproto only allows "plc" and "web" DID methods`)

export function isAtprotoDid(input: unknown): input is AtprotoDid {
  return isDidPlc(input) || isAtprotoDidWeb(input)
}

export function asAtprotoDid<T>(input: T) {
  assertAtprotoDid(input)
  return input
}

export function assertAtprotoDid(input: unknown): asserts input is AtprotoDid {
  if (typeof input !== 'string') {
    throw new InvalidDidError(typeof input, `DID must be a string`)
  } else if (input.startsWith(DID_PLC_PREFIX)) {
    assertDidPlc(input)
  } else if (input.startsWith(DID_WEB_PREFIX)) {
    assertAtprotoDidWeb(input)
  } else {
    throw new InvalidDidError(
      input,
      `Atproto only allows "plc" and "web" DID methods`,
    )
  }
}

export function assertAtprotoDidWeb(
  input: unknown,
): asserts input is Did<'web'> {
  assertDidWeb(input)

  if (isDidWebWithPath(input)) {
    throw new InvalidDidError(
      input,
      `Atproto does not allow path components in Web DIDs`,
    )
  }

  if (isDidWebWithHttpsPort(input)) {
    throw new InvalidDidError(
      input,
      `Atproto does not allow port numbers in Web DIDs, except for localhost`,
    )
  }
}

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export function isAtprotoDidWeb(input: unknown): input is Did<'web'> {
  if (!isDidWeb(input)) {
    return false
  }

  if (isDidWebWithPath(input)) {
    return false
  }

  if (isDidWebWithHttpsPort(input)) {
    return false
  }

  return true
}

function isDidWebWithPath(did: Did<'web'>): boolean {
  return did.includes(':', DID_WEB_PREFIX.length)
}

function isLocalhostDid(did: Did<'web'>): boolean {
  return (
    did === 'did:web:localhost' ||
    did.startsWith('did:web:localhost:') ||
    did.startsWith('did:web:localhost%3A')
  )
}

function isDidWebWithHttpsPort(did: Did<'web'>): boolean {
  if (isLocalhostDid(did)) return false

  const pathIdx = did.indexOf(':', DID_WEB_PREFIX.length)

  const hasPort =
    pathIdx === -1
      ? // No path component, check if there's a port separator anywhere after
        // the "did:web:" prefix
        did.includes('%3A', DID_WEB_PREFIX.length)
      : // There is a path component; if there is an encoded colon *before* it,
        // then there is a port number
        did.lastIndexOf('%3A', pathIdx) !== -1

  return hasPort
}

export type AtprotoAudience = `${AtprotoDid}#${string}`
export const isAtprotoAudience = (value: unknown): value is AtprotoAudience => {
  if (typeof value !== 'string') return false
  const hashIndex = value.indexOf('#')
  if (hashIndex === -1) return false
  if (value.indexOf('#', hashIndex + 1) !== -1) return false
  return (
    isFragment(value, hashIndex + 1) && isAtprotoDid(value.slice(0, hashIndex))
  )
}

export type AtprotoData<
  M extends AtprotoIdentityDidMethods = AtprotoIdentityDidMethods,
> = {
  did: Did<M>
  aka?: string
  key?: AtprotoVerificationMethod<M>
  pds?: AtprotoPersonalDataServerService<M>
}

export function extractAtprotoData<M extends AtprotoIdentityDidMethods>(
  document: DidDocument<M>,
): AtprotoData<M> {
  return {
    did: document.id,
    aka: document.alsoKnownAs?.find(isAtprotoAka)?.slice(5),
    key: document.verificationMethod?.find(
      isAtprotoVerificationMethod<M>,
      document,
    ),
    pds: document.service?.find(
      isAtprotoPersonalDataServerService<M>,
      document,
    ),
  }
}

export function extractPdsUrl(document: AtprotoDidDocument): URL {
  const service = document.service?.find(
    isAtprotoPersonalDataServerService,
    document,
  )

  if (!service) {
    throw new DidError(
      document.id,
      `Document ${document.id} does not contain a (valid) #atproto_pds service URL`,
      'did-service-not-found',
    )
  }

  return new URL(service.serviceEndpoint)
}

export type AtprotoAka = `at://${string}`
export function isAtprotoAka(value: string): value is AtprotoAka {
  return value.startsWith('at://')
}

export type AtprotoPersonalDataServerService<
  M extends AtprotoIdentityDidMethods = AtprotoIdentityDidMethods,
> = DidService & {
  id: Identifier<Did<M>, 'atproto_pds'>
  type: 'AtprotoPersonalDataServer'
  serviceEndpoint: string
}

export function isAtprotoPersonalDataServerService<
  M extends AtprotoIdentityDidMethods = AtprotoIdentityDidMethods,
>(
  this: DidDocument<M>,
  service: null | undefined | DidService,
): service is AtprotoPersonalDataServerService<M> {
  return (
    service?.type === 'AtprotoPersonalDataServer' &&
    typeof service.serviceEndpoint === 'string' &&
    canParse(service.serviceEndpoint) &&
    matchesIdentifier(this.id, 'atproto_pds', service.id)
  )
}

export const ATPROTO_VERIFICATION_METHOD_TYPES = Object.freeze([
  'EcdsaSecp256r1VerificationKey2019',
  'EcdsaSecp256k1VerificationKey2019',
  'Multikey',
] as const)
export type SupportedAtprotoVerificationMethodType =
  (typeof ATPROTO_VERIFICATION_METHOD_TYPES)[number]

type VerificationMethod = NonNullable<DidDocument['verificationMethod']>[number]
export type AtprotoVerificationMethod<
  M extends AtprotoIdentityDidMethods = AtprotoIdentityDidMethods,
> = Extract<VerificationMethod, object> & {
  id: Identifier<Did<M>, 'atproto'>
  type: SupportedAtprotoVerificationMethodType
  publicKeyMultibase: string
}

export function isAtprotoVerificationMethod<
  M extends AtprotoIdentityDidMethods = AtprotoIdentityDidMethods,
>(
  this: DidDocument<M>,
  method:
    | null
    | undefined
    | NonNullable<DidDocument<M>['verificationMethod']>[number],
): method is AtprotoVerificationMethod<M> {
  return (
    typeof method === 'object' &&
    typeof method?.publicKeyMultibase === 'string' &&
    (ATPROTO_VERIFICATION_METHOD_TYPES as readonly unknown[]).includes(
      method.type,
    ) &&
    matchesIdentifier(this.id, 'atproto', method.id)
  )
}
