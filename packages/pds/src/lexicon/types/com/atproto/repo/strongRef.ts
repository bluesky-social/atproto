/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { isObj, hasProp } from '../../../../util'

export interface Main {
  uri: string
  cid: string
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'com.atproto.repo.strongRef#main' ||
      v.$type === 'com.atproto.repo.strongRef')
  )
}
