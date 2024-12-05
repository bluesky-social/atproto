import { Cid, Did } from './lexicon-infer.js'

export type UnknownRecord<T extends string = string> = { $type: T } & {
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

export interface CommitEvent<R extends UnknownRecord = UnknownRecord>
  extends EventBase {
  kind: EventKind.Commit
  commit: CommitCreate<R> | CommitUpdate<R> | CommitDelete<R>
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

export type CommitCreate<R extends UnknownRecord> = {
  [T in R['$type']]: CommitBase & {
    collection: T
    operation: CommitOperation.Create
  } & (
      | {
          recordValid: true
          record: Extract<R, { $type: T }>
        }
      | {
          recordValid: false
          record: UnknownRecord<T>
        }
    )
}[R['$type']]

export type CommitUpdate<R extends UnknownRecord> = {
  [T in R['$type']]: CommitBase & {
    collection: T
    operation: CommitOperation.Update
    cid: Cid
  } & (
      | {
          recordValid: true
          record: Extract<R, { $type: T }>
        }
      | {
          recordValid: false
          record: UnknownRecord<T>
        }
    )
}[R['$type']]

export type CommitDelete<R extends UnknownRecord> = {
  [T in R['$type']]: CommitBase & {
    collection: T
    operation: CommitOperation.Delete
  }
}[R['$type']]
