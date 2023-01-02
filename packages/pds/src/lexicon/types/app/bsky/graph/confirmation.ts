/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { isObj, hasProp } from '../../../../util'
import * as AppBskyActorRef from '../actor/ref'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export interface Record {
  originator: AppBskyActorRef.Main
  assertion: ComAtprotoRepoStrongRef.Main
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.graph.confirmation#main' ||
      v.$type === 'app.bsky.graph.confirmation')
  )
}
