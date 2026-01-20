import { LexMap, LexValue, l } from '@atproto/lex'
import { DidString, HandleString, NsidString } from '@atproto/syntax'

export const recordEventDataSchema = l.object({
  did: l.string({ format: 'did' }),
  rev: l.string(),
  collection: l.string({ format: 'nsid' }),
  rkey: l.string({ format: 'record-key' }),
  action: l.enum(['create', 'update', 'delete']),
  record: l.optional(l.unknownObject()),
  cid: l.optional(l.string({ format: 'cid' })),
  live: l.boolean(),
})

export const identityEventDataSchema = l.object({
  did: l.string({ format: 'did' }),
  handle: l.string({ format: 'handle' }),
  is_active: l.boolean(),
  status: l.enum([
    'active',
    'takendown',
    'suspended',
    'deactivated',
    'deleted',
  ]),
})

export const recordEventSchema = l.object({
  id: l.integer(),
  type: l.literal('record'),
  record: recordEventDataSchema,
})

export const identityEventSchema = l.object({
  id: l.integer(),
  type: l.literal('identity'),
  identity: identityEventDataSchema,
})

export const tapEventSchema = l.discriminatedUnion('type', [
  recordEventSchema,
  identityEventSchema,
])

export type RecordEvent = {
  id: number
  type: 'record'
  action: 'create' | 'update' | 'delete'
  did: DidString
  rev: string
  collection: NsidString
  rkey: string
  record?: LexMap
  cid?: string
  live: boolean
}

export type IdentityEvent = {
  id: number
  type: 'identity'
  did: DidString
  handle: HandleString
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

export const parseTapEvent = (data: LexValue): TapEvent => {
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

export const repoInfoSchema = l.object({
  did: l.string(),
  handle: l.string(),
  state: l.string(),
  rev: l.string(),
  records: l.integer(),
  error: l.optional(l.string()),
  retries: l.optional(l.integer()),
})

export type RepoInfo = l.Infer<typeof repoInfoSchema>
