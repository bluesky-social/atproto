import { Cid } from '@atproto/lex-data'
import { AtUri, DatetimeString } from '@atproto/syntax'
import { app } from '../lexicons/index.js'
import { LocalViewer } from './viewer'

export type LocalRecords = {
  count: number
  profile: RecordDescript<app.bsky.actor.profile.Main> | null
  posts: RecordDescript<app.bsky.feed.post.Main>[]
}

export type RecordDescript<T> = {
  uri: AtUri
  cid: Cid
  indexedAt: DatetimeString
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
