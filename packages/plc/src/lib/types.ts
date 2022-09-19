import * as z from 'zod'

const documentData = z.object({
  did: z.string(),
  signingKey: z.string(),
  recoveryKey: z.string(),
  username: z.string(),
  atpPds: z.string(),
})
export type DocumentData = z.infer<typeof documentData>

const unsignedCreateOp = z.object({
  type: z.literal('create'),
  signingKey: z.string(),
  recoveryKey: z.string(),
  username: z.string(),
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

const unsignedUpdateUsernameOp = z.object({
  type: z.literal('update_username'),
  username: z.string(),
  prev: z.string(),
})
export type UnsignedUpdateUsernameOp = z.infer<typeof unsignedUpdateUsernameOp>
const updateUsernameOp = unsignedUpdateUsernameOp.extend({
  sig: z.string(),
})
export type UpdateUsernameOp = z.infer<typeof updateUsernameOp>

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
  updateUsernameOp,
  updateAtpPdsOp,
])
export type UpdateOperation = z.infer<typeof updateOperation>

const operation = z.union([createOp, updateOperation])
export type Operation = z.infer<typeof operation>

const unsignedUpdateOperation = z.union([
  unsignedRotateSigningKeyOp,
  unsignedRotateRecoveryKeyOp,
  unsignedUpdateUsernameOp,
  unsignedUpdateAtpPdsOp,
])
export type UnsignedUpdateOperation = z.infer<typeof unsignedUpdateOperation>
const unsignedOperation = z.union([unsignedCreateOp, unsignedUpdateOperation])
export type UnsignedOperation = z.infer<typeof unsignedOperation>

export const def = {
  documentData,
  unsignedCreateOp,
  createOp,
  unsignedRotateSigningKeyOp,
  rotateSigningKeyOp,
  unsignedRotateRecoveryKeyOp,
  rotateRecoveryKeyOp,
  unsignedUpdateUsernameOp,
  updateUsernameOp,
  unsignedUpdateAtpPdsOp,
  updateAtpPdsOp,
  updateOperation,
  operation,
  unsignedUpdateOperation,
  unsignedOperation,
}
