import {
  KeyCapabilitySection,
  DIDDocument,
  DIDDocumentMetadata,
  VerificationMethod,
  ServiceEndpoint,
} from 'did-resolver'
/*export type DidDocVerificationMethodOrLink = string | DidDocVerificationMethod

export type KeyCapabilitySection =
  | 'authentication'
  | 'assertionMethod'
  | 'capabilityDelegation'
  | 'capabilityInvocation'
  | 'keyAgreement'

export interface DIDDocument {
  id: string
  alsoKnownAs?: string[]
  controller?: string | string[]
  service?: DidDocService[]
  verificationMethod?: DidDocVerificationMethod[]

  assertionMethod?: DidDocVerificationMethodOrLink[]
  authentication?: DidDocVerificationMethodOrLink[]
  capabilityDelegation?: DidDocVerificationMethodOrLink[]
  capabilityInvocation?: DidDocVerificationMethodOrLink[]
  keyAgreement?: DidDocVerificationMethodOrLink[]
}

export interface DidDocVerificationMethod {
  id: string
  controller: string
  type: string
  publicKeyJwk?: Record<string, unknown>
  publicKeyMultibase?: string
}

export interface DidDocService {
  id: string
  type: string
  serviceEndpoint: string
}*/

export class DidDocAPI {
  getURI(): string {
    throw new Error('Must be overridden')
  }

  getController(): string {
    throw new Error('Must be overridden')
  }

  listPublicKeys(purpose: KeyCapabilitySection): VerificationMethod[] {
    throw new Error('Must be overridden')
  }

  getPublicKey(purpose: KeyCapabilitySection, offset = 0): VerificationMethod {
    throw new Error('Must be overridden')
  }

  getKeyPair(id: string) {
    throw new Error('Must be overridden')
  }

  listServices(): ServiceEndpoint[] {
    throw new Error('Must be overridden')
  }

  getService(type: string): ServiceEndpoint {
    throw new Error('Must be overridden')
  }
}

export class ReadOnlyDidDocAPI extends DidDocAPI {
  constructor(
    public didDoc: DIDDocument,
    public didDocMetadata?: DIDDocumentMetadata,
  ) {
    super()
  }

  getURI(): string {
    return this.didDoc.id
  }

  getController(): string {
    if (this.didDoc.controller) {
      if (Array.isArray(this.didDoc.controller)) {
        return this.didDoc.controller[0]
      }
      return this.didDoc.controller
    }
    throw new Error('controller is not defined')
  }

  listPublicKeys(purpose: KeyCapabilitySection): VerificationMethod[] {
    const keys = this.didDoc[purpose]
    if (!keys || keys.length === 0) return []
    return keys.map((key: string | VerificationMethod) => {
      if (typeof key === 'string') return findKey(this.didDoc, key)
      return key
    })
  }

  getPublicKey(purpose: KeyCapabilitySection, offset = 0): VerificationMethod {
    const keys = this.didDoc[purpose]
    if (!keys || keys.length === 0) throw new Error('Key not found')
    const key = keys[offset]
    if (!key) throw new Error('Key not found')
    if (typeof key === 'string') return findKey(this.didDoc, key)
    return key
  }

  getKeyPair(id: string) {
    throw new Error('Keypair not available')
  }

  listServices() {
    return this.didDoc.service || []
  }

  getService(type: string) {
    if (!this.didDoc.service || this.didDoc.service.length === 0)
      throw new Error('Service not found')
    const service = this.didDoc.service.find((s) => s.type === type)
    if (!service) throw new Error('Service not found')
    return service
  }
}

function findKey(didDoc: DIDDocument, id: string) {
  if (!didDoc.verificationMethod)
    throw new Error('Malformed DID document: no verification methods set')
  const key = didDoc.verificationMethod.find((m) => m.id === id)
  if (!key)
    throw new Error(
      `Malformed DID document: no verification method of ID ${id} found`,
    )
  return key
}
