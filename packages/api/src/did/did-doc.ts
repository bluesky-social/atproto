import { z } from 'zod'

export const verificationMethod = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyMultibase: z.string().optional(),
})

export const service = z.object({
  id: z.string(),
  type: z.string(),
  serviceEndpoint: z.union([z.string(), z.record(z.unknown())]),
})

export const didDocument = z.object({
  id: z.string(),
  alsoKnownAs: z.array(z.string()).optional(),
  verificationMethod: z.array(verificationMethod).optional(),
  service: z.array(service).optional(),
})

export type DidDocument = z.infer<typeof didDocument>

export function isValidDidDoc(doc: unknown): doc is DidDocument {
  return didDocument.safeParse(doc).success
}

export function getPdsEndpoint(doc: unknown): URL | undefined {
  if (isValidDidDoc(doc)) {
    const pds = doc.service?.find((s) => s.type === 'AtprotoPersonalDataServer')
    if (pds && typeof pds.serviceEndpoint === 'string') {
      try {
        return new URL(pds.serviceEndpoint)
      } catch {
        return undefined
      }
    }
  }
}
