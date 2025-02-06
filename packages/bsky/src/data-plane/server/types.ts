import {
  Commit as CommitEvent,
  Account as AccountEvent,
  Identity as IdentityEvent,
} from '../../lexicon/types/com/atproto/sync/subscribeRepos'

export type FirehoseEvent = CommitEvent | AccountEvent | IdentityEvent

export type StreamEvent =
  | ({ event: 'create'; record: unknown; cid: string } & BaseOpEvent)
  | ({ event: 'update'; record: unknown; cid: string } & BaseOpEvent)
  | ({ event: 'delete' } & BaseOpEvent)
  | ({ event: 'account' } & AccountEvent)
  | ({ event: 'identity' } & IdentityEvent)

type BaseOpEvent = {
  seq: number
  time: string
  commit: string
  rev: string
  did: string
  collection: string
  rkey: string
}
