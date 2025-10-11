import { Label } from '../../lexicon/types/com/atproto/label/defs'
import {
  Info as LabelInfoEvent,
  Labels as LabelsEvent,
} from '../../lexicon/types/com/atproto/label/subscribeLabels'
import {
  Account as AccountEvent,
  Commit as CommitEvent,
  Identity as IdentityEvent,
} from '../../lexicon/types/com/atproto/sync/subscribeRepos'

export const SEQ_BACKFILL = -1

export type FirehoseEvent = CommitEvent | AccountEvent | IdentityEvent

export type LabelerEvent = LabelsEvent | LabelInfoEvent

export type StreamEvent =
  | ({ type: 'create'; record: unknown; cid: string } & BaseOpEvent)
  | ({ type: 'update'; record: unknown; cid: string } & BaseOpEvent)
  | ({ type: 'delete' } & BaseOpEvent)
  | { type: 'repo'; time: string; commit: string; rev: string; did: string }
  | ({ type: 'account' } & AccountEvent)
  | ({ type: 'identity' } & IdentityEvent)

export type LabelStreamEvent = {
  type: 'label'
  label: Label
}

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
