import {
  Account as AccountEvent,
  Commit as CommitEvent,
  Identity as IdentityEvent,
} from '../../lexicon/types/com/atproto/sync/subscribeRepos'

export type FirehoseEvent = CommitEvent | AccountEvent | IdentityEvent

export type StreamEvent =
  | ({ type: 'create'; record: unknown; cid: string } & BaseOpEvent)
  | ({ type: 'update'; record: unknown; cid: string } & BaseOpEvent)
  | ({ type: 'delete' } & BaseOpEvent)
  | ({ type: 'account' } & AccountEvent)
  | ({ type: 'identity' } & IdentityEvent)

export type BackfillEvent = {
  did: string
  host: string
  rev: string
  status: string | undefined
  active: boolean | undefined
}

type BaseOpEvent = {
  seq: number
  time: string
  commit: string
  rev: string
  did: string
  collection: string
  rkey: string
}
