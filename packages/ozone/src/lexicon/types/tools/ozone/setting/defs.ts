/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Option {
  key: string
  did: string
  value: {}
  description?: string
  createdAt?: string
  updatedAt?: string
  managerRole: 'owner' | 'moderator' | 'triage' | 'admin' | (string & {})
  scope: 'instance' | 'personal' | (string & {})
  createdBy: string
  lastUpdatedBy: string
  [k: string]: unknown
}

export function isOption(v: unknown): v is Option {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.setting.defs#option'
  )
}

export function validateOption(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.setting.defs#option', v)
}
