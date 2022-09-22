import {
  DidDocument,
  DidDocVerificationMethod,
  DidDocService,
  KeyCapabilitySection,
} from './types'

export class DidDocAPI {
  constructor(public didDoc: DidDocument) {}

  gidDID(): string {
    return this.didDoc.id
  }

  getController(): string {
    if (this.didDoc.controller) {
      if (Array.isArray(this.didDoc.controller)) {
        return this.didDoc.controller[0]
      }
      return this.didDoc.controller
    }
    throw new Error('Controller is not defined')
  }

  listPublicKeys(purpose: KeyCapabilitySection): DidDocVerificationMethod[] {
    const keys = this.didDoc[purpose]
    if (!keys || keys.length === 0) return []
    return keys.map((key: string | DidDocVerificationMethod) => {
      if (typeof key === 'string') return findKey(this.didDoc, key)
      return key
    })
  }

  getPublicKey(
    purpose: KeyCapabilitySection,
    offset = 0,
  ): DidDocVerificationMethod {
    const keys = this.didDoc[purpose]
    if (!keys || keys.length === 0) throw new Error('Key not found')
    const key = keys[offset]
    if (!key) throw new Error('Key not found')
    if (typeof key === 'string') return findKey(this.didDoc, key)
    return key
  }

  listServices(): DidDocService[] {
    return this.didDoc.service || []
  }

  getService(type: string): DidDocService {
    if (!this.didDoc.service || this.didDoc.service.length === 0)
      throw new Error('Service not found')
    const service = this.didDoc.service.find((s) => s.type === type)
    if (!service) throw new Error('Service not found')
    return service
  }
}

function findKey(didDoc: DidDocument, id: string) {
  if (!didDoc.verificationMethod)
    throw new Error('Malformed DID document: no verification methods set')
  const key = didDoc.verificationMethod.find((m) => m.id === id)
  if (!key)
    throw new Error(
      `Malformed DID document: no verification method of ID ${id} found`,
    )
  return key
}
