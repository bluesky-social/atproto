/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Set {
  name: string
  description?: string
  [k: string]: unknown
}

export function isSet(v: unknown): v is Set {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'tools.ozone.sets.defs#set'
  )
}

export function validateSet(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.sets.defs#set', v)
}

export interface SetView {
  name: string
  description?: string
  setSize: number
  createdAt: string
  updatedAt: string
  [k: string]: unknown
}

export function isSetView(v: unknown): v is SetView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.sets.defs#setView'
  )
}

export function validateSetView(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.sets.defs#setView', v)
}
