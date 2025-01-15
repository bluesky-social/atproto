import { Cid, Did } from './lexicon-infer.js'

export type UnknownRecord<T extends string = string> = {
  $type: T
  [k: string]: unknown
}
export type UnknownEvent = { kind: string }

export interface EventBase {
  did: Did
  time_us: number
  kind: EventKind
}

export enum EventKind {
  Commit = 'commit',
  Account = 'account',
  Identity = 'identity',
}

//- AccountEvent

export interface AccountEvent extends EventBase {
  kind: EventKind.Account
  account: Account
}

export function isAccountEvent(event: UnknownEvent): event is AccountEvent {
  // @TODO: validate event.account
  return event.kind === EventKind.Account
}

export interface Account {
  seq: number
  did: string
  time: string
  active: boolean
  status?:
    | 'takendown'
    | 'suspended'
    | 'deleted'
    | 'deactivated'
    | (string & NonNullable<unknown>)
  [k: string]: unknown
}

//- IdentityEvent

export interface IdentityEvent extends EventBase {
  kind: EventKind.Identity
  identity: Identity
}

export function isIdentityEvent(event: UnknownEvent): event is IdentityEvent {
  // @TODO: validate event.identity
  return event.kind === EventKind.Identity
}

export interface Identity {
  seq: number
  did: string
  time: string
  handle?: string
  [k: string]: unknown
}

//- CommitEvent

export interface CommitEvent<
  KnownRecord extends UnknownRecord = UnknownRecord,
  Collections extends KnownRecord['$type'] | undefined = undefined,
> extends EventBase {
  kind: EventKind.Commit
  commit: Collections extends undefined
    ?
        | CommitDelete
        | CommitCreate<UnknownRecord, Error>
        | CommitUpdate<UnknownRecord, Error>
        | {
            [T in KnownRecord['$type']]:
              | CommitCreate<Extract<KnownRecord, { $type: T }>, null>
              | CommitUpdate<Extract<KnownRecord, { $type: T }>, null>
          }[KnownRecord['$type']]
    : {
        [T in KnownRecord['$type']]:
          | CommitDelete<Extract<KnownRecord, { $type: T }>>
          | CommitCreate<Extract<KnownRecord, { $type: T }>, null>
          | CommitUpdate<Extract<KnownRecord, { $type: T }>, null>
          | CommitCreate<UnknownRecord<T>, Error>
          | CommitUpdate<UnknownRecord<T>, Error>
      }[NonNullable<Collections>]
}

export function isCommitEvent(event: UnknownEvent): event is CommitEvent {
  return event.kind === EventKind.Commit
}

export enum CommitOperation {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export interface CommitBase {
  rev: string
  collection: string
  rkey: string
  operation: CommitOperation
}

export type CommitCreate<
  R extends UnknownRecord = UnknownRecord,
  E extends Error | null = Error | null,
> = CommitBase & {
  collection: R['$type']
  operation: CommitOperation.Create
  record: R
  recordError: E
}

export type CommitUpdate<
  R extends UnknownRecord = UnknownRecord,
  E extends Error | null = Error | null,
> = CommitBase & {
  collection: R['$type']
  operation: CommitOperation.Update
  cid: Cid
  record: R
  recordError: E
}

export type CommitDelete<R extends UnknownRecord = UnknownRecord> =
  CommitBase & {
    collection: R['$type']
    operation: CommitOperation.Delete
  }
