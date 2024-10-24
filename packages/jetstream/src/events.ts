export type Cid = string
export type Did = `did:${string}`

export enum EventKind {
  Commit = 'commit',
  Account = 'account',
  Identity = 'identity',
}

export interface EventBase {
  did: Did
  time_us: number
  kind: EventKind
}

//- AccountEvent

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

export interface AccountEvent extends EventBase {
  kind: EventKind.Account
  account: Account
}

export function isAccountEvent(event: EventBase): event is AccountEvent {
  return event.kind === EventKind.Account
}

//- IdentityEvent

export interface Identity {
  seq: number
  did: string
  time: string
  handle?: string
  [k: string]: unknown
}

export interface IdentityEvent extends EventBase {
  kind: EventKind.Identity
  identity: Identity
}

export function isIdentityEvent(event: EventBase): event is IdentityEvent {
  return event.kind === EventKind.Identity
}

//- CommitEvent

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

export interface CommitCreate<Record = unknown> extends CommitBase {
  operation: CommitOperation.Create
  record: Record
  cid: Cid
}

export function isCommitCreate(commit: CommitBase): commit is CommitCreate {
  return commit.operation === CommitOperation.Create
}

export interface CommitUpdate<Record = unknown> extends CommitBase {
  operation: CommitOperation.Update
  record: Record
  cid: Cid
}

export function isCommitUpdate(commit: CommitBase): commit is CommitUpdate {
  return commit.operation === CommitOperation.Update
}

export interface CommitDelete extends CommitBase {
  operation: CommitOperation.Delete
}

export function isCommitDelete(commit: CommitBase): commit is CommitDelete {
  return commit.operation === CommitOperation.Delete
}

export interface CommitEvent<Record = unknown> extends EventBase {
  kind: EventKind.Commit
  commit: CommitCreate<Record> | CommitUpdate<Record> | CommitDelete
}

export function isCommitEvent(event: EventBase): event is CommitEvent {
  return event.kind === EventKind.Commit
}
