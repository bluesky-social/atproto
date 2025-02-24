import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Headers } from '@atproto/xrpc'
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
  cid: CID
  indexedAt: string
  record: T
}

export type ApiRes<T> = {
  headers: Headers
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
