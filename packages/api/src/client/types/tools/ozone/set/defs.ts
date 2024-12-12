/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'tools.ozone.set.defs'

export interface Set {
  name: string
  description?: string
  [k: string]: unknown
}

export function isSet(
  v: unknown,
): v is Set & { $type: $Type<'tools.ozone.set.defs', 'set'> } {
  return is$typed(v, id, 'set')
}

export function validateSet(v: unknown) {
  return lexicons.validate(`${id}#set`, v) as ValidationResult<Set>
}

export interface SetView {
  name: string
  description?: string
  setSize: number
  createdAt: string
  updatedAt: string
  [k: string]: unknown
}

export function isSetView(
  v: unknown,
): v is SetView & { $type: $Type<'tools.ozone.set.defs', 'setView'> } {
  return is$typed(v, id, 'setView')
}

export function validateSetView(v: unknown) {
  return lexicons.validate(`${id}#setView`, v) as ValidationResult<SetView>
}
