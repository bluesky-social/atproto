import {
  Commit as CommitEvent,
  Account as AccountEvent,
  Identity as IdentityEvent,
} from '../../lexicon/types/com/atproto/sync/subscribeRepos'

export type FirehoseEvent = CommitEvent | AccountEvent | IdentityEvent

export type StreamEvent =
  | ({ type: 'create'; record: unknown; cid: string } & BaseOpEvent)
  | ({ type: 'update'; record: unknown; cid: string } & BaseOpEvent)
  | ({ type: 'delete' } & BaseOpEvent)
  | ({ type: 'account' } & AccountEvent)
  | ({ type: 'identity' } & IdentityEvent)

type BaseOpEvent = {
  seq: number
  time: string
  commit: string
  rev: string
  did: string
  collection: string
  rkey: string
}
