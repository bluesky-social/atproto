import { DIDResolutionResult } from 'did-resolver'

export const error = (errorType: string): DIDResolutionResult => {
  return {
    didResolutionMetadata: { error: errorType },
    didDocument: null,
    didDocumentMetadata: {},
  }
}

export const notFound = (): DIDResolutionResult => {
  return error('notFound')
}

export const invalidDid = (): DIDResolutionResult => {
  return error('invalidDid')
}

export const unsupported = (): DIDResolutionResult => {
  return error('unsupportedDidMethod')
}
