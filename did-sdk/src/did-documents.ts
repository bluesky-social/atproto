import {
  KeyCapabilitySection,
  DIDDocument,
  DIDDocumentMetadata,
  VerificationMethod,
  ServiceEndpoint,
} from 'did-resolver'

export class DidDocAPI {
  get didDoc(): DIDDocument {
    throw new Error('Must be overridden')
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

  listServices(): ServiceEndpoint[] {
    return this.didDoc.service || []
  }

  getService(type: string): ServiceEndpoint {
    if (!this.didDoc.service || this.didDoc.service.length === 0)
      throw new Error('Service not found')
    const service = this.didDoc.service.find((s) => s.type === type)
    if (!service) throw new Error('Service not found')
    return service
  }
}

export class WritableDidDocAPI extends DidDocAPI {
  serialize(): any {
    throw new Error('Must be overridden')
  }

  async hydrate(state: any): Promise<void> {
    throw new Error('Must be overridden')
  }
}

export class ReadOnlyDidDocAPI extends DidDocAPI {
  constructor(
    private _didDoc: DIDDocument,
    public didDocMetadata?: DIDDocumentMetadata,
  ) {
    super()
  }

  get didDoc(): DIDDocument {
    return this._didDoc
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
