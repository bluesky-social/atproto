import { Cid } from '@atproto/lex-data'
import { AtUri } from '@atproto/syntax'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { LocalViewer } from './viewer'

export type LocalRecords = {
  count: number
  profile: RecordDescript<ProfileRecord> | null
  posts: RecordDescript<PostRecord>[]
}

export type RecordDescript<T> = {
  uri: AtUri
  cid: Cid
  indexedAt: string
  record: T
}

export type ApiRes<T> = {
  headers: Record<string, string | undefined>
  data: T
}

export type MungeFn<T> = (
  localViewer: LocalViewer,
  original: T,
  local: LocalRecords,
  requester: string,
) => Promise<T>

export type HandlerResponse<T> = {
  encoding: 'application/json'
  body: T
  headers?: Record<string, string>
}
