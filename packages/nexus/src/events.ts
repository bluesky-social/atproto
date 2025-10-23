import { z } from 'zod'

export const recordEventDataSchema = z.object({
  did: z.string(),
  rev: z.string(),
  collection: z.string(),
  rkey: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  record: z.record(z.string(), z.unknown()).optional(),
  cid: z.string().optional(),
})
export type RecordEventData = z.infer<typeof recordEventDataSchema>

export const userEventDataSchema = z.object({
  did: z.string(),
  handle: z.string(),
  is_active: z.boolean(),
  status: z.enum([
    'active',
    'takendown',
    'suspended',
    'deactivated',
    'deleted',
  ]),
})
export type UserEventData = z.infer<typeof userEventDataSchema>

export const recordEventSchema = z.object({
  id: z.number(),
  type: z.literal('record'),
  record: recordEventDataSchema,
})
export type RecordEvent = z.infer<typeof recordEventSchema>

export const userEventSchema = z.object({
  id: z.number(),
  type: z.literal('user'),
  user: userEventDataSchema,
})
export type UserEvent = z.infer<typeof userEventSchema>

export const nexusEventSchema = z.union([recordEventSchema, userEventSchema])
export type NexusEvent = z.infer<typeof nexusEventSchema>

export const parseNexusEvent = (data: unknown): NexusEvent => {
  return nexusEventSchema.parse(data)
}
