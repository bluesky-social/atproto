// @TODO what else here? Freeze & Resolve?
import * as z from 'zod'

export const opBase = z.object({
  time: z.string(),
  sig: z.string(),
})

export const create = opBase.extend({
  type: z.literal('create'),
  signingKey: z.string(),
  recoveryKey: z.string(),
  username: z.string(),
  service: z.string(),
})
export type Create = z.infer<typeof create>

export const rotateSigningKey = opBase.extend({
  type: z.literal('rotate_signing_key'),
  key: z.string(),
})
export type RotateSigningKey = z.infer<typeof rotateSigningKey>

export const rotateRecoveryKey = opBase.extend({
  type: z.literal('rotate_recovery_key'),
  key: z.string(),
})
export type RotateRecoveryKey = z.infer<typeof rotateRecoveryKey>

export const updateUsername = opBase.extend({
  type: z.literal('update_username'),
  username: z.string(),
})
export type UpdateUsername = z.infer<typeof updateUsername>

export const updateService = opBase.extend({
  type: z.literal('update_service'),
  service: z.string(),
})
export type UpdateService = z.infer<typeof updateService>

export const operation = z.union([
  create,
  rotateSigningKey,
  rotateRecoveryKey,
  updateUsername,
  updateService,
])

export type Operation = z.infer<typeof operation>
