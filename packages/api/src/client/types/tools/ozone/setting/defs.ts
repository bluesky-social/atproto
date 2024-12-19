/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'tools.ozone.setting.defs'

export interface Option {
  key: string
  did: string
  value: {}
  description?: string
  createdAt?: string
  updatedAt?: string
  managerRole?:
    | 'tools.ozone.team.defs#roleModerator'
    | 'tools.ozone.team.defs#roleTriage'
    | 'tools.ozone.team.defs#roleAdmin'
    | (string & {})
  scope: 'instance' | 'personal' | (string & {})
  createdBy: string
  lastUpdatedBy: string
  [k: string]: unknown
}

export function isOption(
  v: unknown,
): v is Option & { $type: $Type<'tools.ozone.setting.defs', 'option'> } {
  return is$typed(v, id, 'option')
}

export function validateOption(v: unknown) {
  return lexicons.validate(`${id}#option`, v) as ValidationResult<Option>
}
