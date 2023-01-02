/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { isObj, hasProp } from '../../../../util'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export interface Record {
  subject: ComAtprotoRepoStrongRef.Main
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.feed.trend#main' ||
      v.$type === 'app.bsky.feed.trend')
  )
}
