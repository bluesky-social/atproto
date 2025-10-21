import { z } from 'zod'
import { AtUri } from '@atproto/syntax'

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

export const recordEvt = z.object({
  id: z.number(),
  type: z.literal('record'),
  record: recordEventDataSchema,
})

export const userEvt = z.object({
  id: z.number(),
  type: z.literal('user'),
  user: userEventDataSchema,
})

export const nexusEvt = z.union([recordEvt, userEvt])

export interface NexusEvent {
  id: number
  did: string
  isRecordEvt(): this is RecordEvent
  isUserEvt(): this is UserEvent
  ack(): Promise<boolean>
}

export type AckFn = (id: number) => Promise<boolean>

export class RecordEvent implements NexusEvent {
  constructor(
    public id: number,
    public data: RecordEventData,
    private _ack?: AckFn,
  ) {}

  async ack() {
    if (this._ack) {
      return this._ack(this.id)
    }
    return false
  }

  get did() {
    return this.data.did
  }

  get uri(): AtUri {
    return AtUri.make(this.data.did, this.data.collection, this.data.rkey)
  }

  isRecordEvt(): this is RecordEvent {
    return true
  }

  isUserEvt(): this is UserEvent {
    return false
  }

  toString() {
    return `RecordEvent(id=${this.id}, did=${this.did}, data=${JSON.stringify(this.data)})`
  }
}

export class UserEvent implements NexusEvent {
  constructor(
    public id: number,
    public data: UserEventData,
    private _ack?: AckFn,
  ) {}

  async ack() {
    if (this._ack) {
      return this._ack(this.id)
    }
    return false
  }

  get did() {
    return this.data.did
  }

  isRecordEvt(): this is RecordEvent {
    return false
  }

  isUserEvt(): this is UserEvent {
    return true
  }

  toString() {
    return `UserEvent(id=${this.id}, did=${this.did}, data=${JSON.stringify(this.data)})`
  }
}

export const parseNexusEvent = (data: unknown, ack?: AckFn): NexusEvent => {
  const msg = nexusEvt.parse(data)
  return msg.type === 'record'
    ? new RecordEvent(msg.id, msg.record, ack)
    : new UserEvent(msg.id, msg.user, ack)
}
