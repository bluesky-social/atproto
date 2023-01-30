/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as AppBskySystemDeclRef from '../system/declRef'

export interface Main {
  did: string
  declarationCid: string
  [k: string]: unknown
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

export interface ViewerState {
  muted?: boolean
  [k: string]: unknown
}
