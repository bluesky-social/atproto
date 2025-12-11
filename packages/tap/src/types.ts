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

export const identityEventDataSchema = z.object({
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

export const identityEventSchema = z.object({
  id: z.number(),
  type: z.literal('identity'),
  identity: identityEventDataSchema,
})

export const tapEventSchema = z.union([recordEventSchema, identityEventSchema])

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

export type IdentityEvent = {
  id: number
  type: 'identity'
  did: string
  handle: string
  isActive: boolean
  status: RepoStatus
}

export type RepoStatus =
  | 'active'
  | 'takendown'
  | 'suspended'
  | 'deactivated'
  | 'deleted'

export type TapEvent = IdentityEvent | RecordEvent

export const parseTapEvent = (data: unknown): TapEvent => {
  const parsed = tapEventSchema.parse(data)
  if (parsed.type === 'identity') {
    return {
      id: parsed.id,
      type: parsed.type,
      did: parsed.identity.did,
      handle: parsed.identity.handle,
      isActive: parsed.identity.is_active,
      status: parsed.identity.status,
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

export const repoInfoSchema = z.object({
  did: z.string(),
  handle: z.string(),
  state: z.string(),
  rev: z.string(),
  records: z.number(),
  error: z.string().optional(),
  retries: z.number().optional(),
})

export type RepoInfo = z.infer<typeof repoInfoSchema>
