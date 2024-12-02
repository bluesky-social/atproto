/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'tools.ozone.set.defs'

export interface Set {
  $type?: $Type<'tools.ozone.set.defs', 'set'>
  name: string
  description?: string
}

export function isSet<V>(v: V) {
  return is$typed(v, id, 'set')
}

export function validateSet(v: unknown) {
  return lexicons.validate(`${id}#set`, v) as ValidationResult<Set>
}

export function isValidSet<V>(v: V): v is V & $Typed<Set> {
  return isSet(v) && validateSet(v).success
}

export interface SetView {
  $type?: $Type<'tools.ozone.set.defs', 'setView'>
  name: string
  description?: string
  setSize: number
  createdAt: string
  updatedAt: string
}

export function isSetView<V>(v: V) {
  return is$typed(v, id, 'setView')
}

export function validateSetView(v: unknown) {
  return lexicons.validate(`${id}#setView`, v) as ValidationResult<SetView>
}

export function isValidSetView<V>(v: V): v is V & $Typed<SetView> {
  return isSetView(v) && validateSetView(v).success
}
