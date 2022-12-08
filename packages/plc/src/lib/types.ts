import * as z from 'zod'
import * as mf from 'multiformats/cid'

const cid = z
  .any()
  .refine((obj: unknown) => mf.CID.asCID(obj) !== null, {
    message: 'Not a CID',
  })
  .transform((obj: unknown) => mf.CID.asCID(obj) as mf.CID)

const documentData = z.object({
  did: z.string(),
  signingKey: z.string(),
  recoveryKey: z.string(),
  handle: z.string(),
  atpPds: z.string(),
})
export type DocumentData = z.infer<typeof documentData>

const unsignedCreateOp = z.object({
  type: z.literal('create'),
  signingKey: z.string(),
  recoveryKey: z.string(),
  handle: z.string(),
  service: z.string(),
  prev: z.null(),
})
export type UnsignedCreateOp = z.infer<typeof unsignedCreateOp>
const createOp = unsignedCreateOp.extend({ sig: z.string() })
export type CreateOp = z.infer<typeof createOp>

const unsignedRotateSigningKeyOp = z.object({
  type: z.literal('rotate_signing_key'),
  key: z.string(),
  prev: z.string(),
})
export type UnsignedRotateSigningKeyOp = z.infer<
  typeof unsignedRotateSigningKeyOp
>
const rotateSigningKeyOp = unsignedRotateSigningKeyOp.extend({
  sig: z.string(),
})
export type RotateSigningKeyOp = z.infer<typeof rotateSigningKeyOp>

const unsignedRotateRecoveryKeyOp = z.object({
  type: z.literal('rotate_recovery_key'),
  key: z.string(),
  prev: z.string(),
})
export type UnsignedRotateRecoveryKeyOp = z.infer<
  typeof unsignedRotateRecoveryKeyOp
>
const rotateRecoveryKeyOp = unsignedRotateRecoveryKeyOp.extend({
  sig: z.string(),
})
export type RotateRecoveryKeyOp = z.infer<typeof rotateRecoveryKeyOp>

const unsignedUpdateHandleOp = z.object({
  type: z.literal('update_handle'),
  handle: z.string(),
  prev: z.string(),
})
export type UnsignedUpdateHandleOp = z.infer<typeof unsignedUpdateHandleOp>
const updateHandleOp = unsignedUpdateHandleOp.extend({
  sig: z.string(),
})
export type UpdateHandleOp = z.infer<typeof updateHandleOp>

const unsignedUpdateAtpPdsOp = z.object({
  type: z.literal('update_atp_pds'),
  service: z.string(),
  prev: z.string(),
})
export type UnsignedUpdateAtpPdsOp = z.infer<typeof unsignedUpdateAtpPdsOp>
const updateAtpPdsOp = unsignedUpdateAtpPdsOp.extend({
  sig: z.string(),
})
export type UpdateAtpPdsOp = z.infer<typeof updateAtpPdsOp>

const updateOperation = z.union([
  rotateSigningKeyOp,
  rotateRecoveryKeyOp,
  updateHandleOp,
  updateAtpPdsOp,
])
export type UpdateOperation = z.infer<typeof updateOperation>

const operation = z.union([createOp, updateOperation])
export type Operation = z.infer<typeof operation>

const unsignedUpdateOperation = z.union([
  unsignedRotateSigningKeyOp,
  unsignedRotateRecoveryKeyOp,
  unsignedUpdateHandleOp,
  unsignedUpdateAtpPdsOp,
])
export type UnsignedUpdateOperation = z.infer<typeof unsignedUpdateOperation>
const unsignedOperation = z.union([unsignedCreateOp, unsignedUpdateOperation])
export type UnsignedOperation = z.infer<typeof unsignedOperation>

export const indexedOperation = z.object({
  did: z.string(),
  operation: operation,
  cid: cid,
  nullified: z.boolean(),
  createdAt: z.date(),
})
export type IndexedOperation = z.infer<typeof indexedOperation>

export const didDocVerificationMethod = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyMultibase: z.string(),
})

export const didDocService = z.object({
  id: z.string(),
  type: z.string(),
  serviceEndpoint: z.string(),
})

export const didDocument = z.object({
  '@context': z.array(z.string()),
  id: z.string(),
  alsoKnownAs: z.array(z.string()),
  verificationMethod: z.array(didDocVerificationMethod),
  assertionMethod: z.array(z.string()),
  capabilityInvocation: z.array(z.string()),
  capabilityDelegation: z.array(z.string()),
  service: z.array(didDocService),
})
export type DidDocument = z.infer<typeof didDocument>

export const def = {
  documentData,
  unsignedCreateOp,
  createOp,
  unsignedRotateSigningKeyOp,
  rotateSigningKeyOp,
  unsignedRotateRecoveryKeyOp,
  rotateRecoveryKeyOp,
  unsignedUpdateHandleOp,
  updateHandleOp,
  unsignedUpdateAtpPdsOp,
  updateAtpPdsOp,
  updateOperation,
  operation,
  unsignedUpdateOperation,
  unsignedOperation,
  indexedOperation,
  didDocument,
}
