import { z } from 'zod'

export const recordEventDataSchema = z.object({
  did: z.string(),
  rev: z.string(),
  collection: z.string(),
  rkey: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  record: z.record(z.string(), z.unknown()).optional(),
  cid: z.string().optional(),
  live: z.boolean(),
})

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

export const recordEventSchema = z.object({
  id: z.number(),
  type: z.literal('record'),
  record: recordEventDataSchema,
})

export const userEventSchema = z.object({
  id: z.number(),
  type: z.literal('user'),
  user: userEventDataSchema,
})

export const nexusEventSchema = z.union([recordEventSchema, userEventSchema])

export type RecordEvent = {
  id: number
  type: 'record'
  action: 'create' | 'update' | 'delete'
  did: string
  rev: string
  collection: string
  rkey: string
  record?: Record<string, unknown>
  cid?: string
  live: boolean
}

export type UserEvent = {
  id: number
  type: 'user'
  did: string
  handle: string
  isActive: boolean
  status: 'active' | 'takendown' | 'suspended' | 'deactivated' | 'deleted'
}

export type NexusEvent = UserEvent | RecordEvent

export const parseNexusEvent = (data: unknown): NexusEvent => {
  const parsed = nexusEventSchema.parse(data)
  if (parsed.type === 'user') {
    return {
      id: parsed.id,
      type: parsed.type,
      did: parsed.user.did,
      handle: parsed.user.handle,
      isActive: parsed.user.is_active,
      status: parsed.user.status,
    }
  } else {
    return {
      id: parsed.id,
      type: parsed.type,
      action: parsed.record.action,
      did: parsed.record.did,
      rev: parsed.record.rev,
      collection: parsed.record.collection,
      rkey: parsed.record.rkey,
      record: parsed.record.record,
      cid: parsed.record.cid,
      live: parsed.record.live,
    }
  }
}
