/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'tools.ozone.setting.defs'

export interface Option {
  $type?: $Type<'tools.ozone.setting.defs', 'option'>
  key: string
  did: string
  value: { [_ in string]: unknown }
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
}

export function isOption<V>(v: V) {
  return is$typed(v, id, 'option')
}

export function validateOption(v: unknown) {
  return lexicons.validate(`${id}#option`, v) as ValidationResult<Option>
}

export function isValidOption<V>(v: V): v is V & $Typed<Option> {
  return isOption(v) && validateOption(v).success
}
