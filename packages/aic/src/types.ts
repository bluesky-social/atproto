// @TODO what else here? Freeze & Resolve?
import * as z from 'zod'

export const unsignedCreateOp = z.object({
  type: z.literal('create'),
  signingKey: z.string(),
  recoveryKey: z.string(),
  username: z.string(),
  service: z.string(),
  prev: z.null(),
})
export type UnsignedCreateOp = z.infer<typeof unsignedCreateOp>
export const createOp = unsignedCreateOp.extend({ sig: z.string() })
export type CreateOp = z.infer<typeof createOp>

export const unsignedRotateSigningKeyOp = z.object({
  type: z.literal('rotate_signing_key'),
  key: z.string(),
  prev: z.string(),
})
export type UnsignedRotateSigningKeyOp = z.infer<
  typeof unsignedRotateSigningKeyOp
>
export const rotateSigningKeyOp = unsignedRotateSigningKeyOp.extend({
  sig: z.string(),
})
export type RotateSigningKeyOp = z.infer<typeof rotateSigningKeyOp>

export const unsignedRotateRecoveryKeyOp = z.object({
  type: z.literal('rotate_recovery_key'),
  key: z.string(),
  prev: z.string(),
})
export type UnsignedRotateRecoveryKeyOp = z.infer<
  typeof unsignedRotateRecoveryKeyOp
>
export const rotateRecoveryKeyOp = unsignedRotateRecoveryKeyOp.extend({
  sig: z.string(),
})
export type RotateRecoveryKeyOp = z.infer<typeof rotateRecoveryKeyOp>

export const unsignedUpdateUsernameOp = z.object({
  type: z.literal('update_username'),
  username: z.string(),
  prev: z.string(),
})
export type UnsignedUpdateUsernameOp = z.infer<typeof unsignedUpdateUsernameOp>
export const updateUsernameOp = unsignedUpdateUsernameOp.extend({
  sig: z.string(),
})
export type UpdateUsernameOp = z.infer<typeof updateUsernameOp>

export const unsignedUpdateServiceOp = z.object({
  type: z.literal('update_service'),
  service: z.string(),
  prev: z.string(),
})
export type UnsignedUpdateServiceOp = z.infer<typeof unsignedUpdateServiceOp>
export const updateServiceOp = unsignedUpdateServiceOp.extend({
  sig: z.string(),
})
export type UpdateServiceOp = z.infer<typeof updateServiceOp>

export const updateOperation = z.union([
  rotateSigningKeyOp,
  rotateRecoveryKeyOp,
  updateUsernameOp,
  updateServiceOp,
])
export type UpdateOperation = z.infer<typeof updateOperation>

export const operation = z.union([createOp, updateOperation])
export type Operation = z.infer<typeof operation>

export const unsignedOperation = z.union([
  unsignedCreateOp,
  unsignedRotateSigningKeyOp,
  unsignedRotateRecoveryKeyOp,
  unsignedUpdateUsernameOp,
  unsignedUpdateServiceOp,
])
export type UnsignedOperation = z.infer<typeof unsignedOperation>
