import { DidDocument, didDocument } from '@atproto/common-web'

export function isValidDidDoc(doc: unknown): doc is DidDocument {
  return didDocument.safeParse(doc).success
}

export function getPdsEndpoint(doc: unknown): URL | undefined {
  if (isValidDidDoc(doc)) {
    const pds = doc.service?.find(
      (s) => s.id === '#atproto_pds' || s.id === `${doc.id}#atproto_pds`,
    )
    if (
      pds &&
      pds.type === 'AtprotoPersonalDataServer' &&
      typeof pds.serviceEndpoint === 'string'
    ) {
      try {
        return new URL(pds.serviceEndpoint)
      } catch {
        return undefined
      }
    }
  }
}
