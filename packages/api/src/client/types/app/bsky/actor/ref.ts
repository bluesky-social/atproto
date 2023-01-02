/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { isObj, hasProp } from '../../../../util'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface Main {
  did: string
  declarationCid: string
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.actor.ref#main' || v.$type === 'app.bsky.actor.ref')
  )
}

export interface WithInfo {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  avatar?: string
  viewer?: ViewerState
  [k: string]: unknown
}

export function isWithInfo(v: unknown): v is WithInfo {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.actor.ref#withInfo'
  )
}

export interface ViewerState {
  muted?: boolean
  [k: string]: unknown
}

export function isViewerState(v: unknown): v is ViewerState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.ref#viewerState'
  )
}
