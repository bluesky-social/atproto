/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { isObj, hasProp } from '../../../../util'
import * as AppBskyActorRef from '../actor/ref'

export interface Record {
  assertion: string
  subject: AppBskyActorRef.Main
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.graph.assertion#main' ||
      v.$type === 'app.bsky.graph.assertion')
  )
}
