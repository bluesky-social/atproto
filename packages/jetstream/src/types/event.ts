import { Account } from './account.js'
import { CommitCreate, CommitDelete, CommitUpdate, isCommit } from './commit.js'
import { Identity } from './identity.js'

export type UnknownEvent = {
  /**
   * The timestamp of the event in microseconds since the epoch.
   */
  time_us: number

  // It's safe to access unknown properties on events
  [k: string]: unknown
}

export enum EventKind {
  Commit = 'commit',
  Account = 'account',
  Identity = 'identity',
}

export type AccountEvent = UnknownEvent & {
  did: string
  kind: EventKind.Account
  account: Account
}

export function isAccountEvent(event: UnknownEvent): event is AccountEvent {
  return event['kind'] === EventKind.Account
}

export type IdentityEvent = UnknownEvent & {
  did: string
  kind: EventKind.Identity
  identity: Identity
}

export function isIdentityEvent(event: UnknownEvent): event is IdentityEvent {
  return event['kind'] === EventKind.Identity
}

export type CommitEvent = UnknownEvent & {
  did: string
  kind: EventKind.Commit
  commit: CommitDelete | CommitCreate | CommitUpdate
}

export function isCommitEvent(event: UnknownEvent): event is CommitEvent {
  return event['kind'] === EventKind.Commit && isCommit(event['commit'])
}

export type KnownEvent = AccountEvent | IdentityEvent | CommitEvent
export function isKnownEvent(event: UnknownEvent): event is KnownEvent {
  return isAccountEvent(event) || isIdentityEvent(event) || isCommitEvent(event)
}
