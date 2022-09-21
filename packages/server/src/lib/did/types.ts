import z from 'zod'

export const didDocVerificationMethod = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyMultibase: z.string(),
})
export type DidDocVerificationMethod = z.infer<typeof didDocVerificationMethod>

export const didDocService = z.object({
  id: z.string(),
  type: z.string(),
  serviceEndpoint: z.string(),
})
export type DidDocService = z.infer<typeof didDocService>

export const didDocument = z.object({
  '@context': z.array(z.string()),
  id: z.string(),
  alsoKnownAs: z.array(z.string()),
  controller: z.union([z.string(), z.array(z.string())]).optional(),
  verificationMethod: z.array(didDocVerificationMethod),
  assertionMethod: z.array(z.string()),
  capabilityInvocation: z.array(z.string()),
  capabilityDelegation: z.array(z.string()),
  service: z.array(didDocService),
})
export type DidDocument = z.infer<typeof didDocument>

export type KeyCapabilitySection =
  | 'verificationMethod'
  | 'assertionMethod'
  | 'capabilityInvocation'
  | 'capabilityDelegation'
