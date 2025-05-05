/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.setting.defs'

export interface Option {
  $type?: 'tools.ozone.setting.defs#option'
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
    | 'tools.ozone.team.defs#roleVerifier'
    | (string & {})
  scope: 'instance' | 'personal' | (string & {})
  createdBy: string
  lastUpdatedBy: string
}

const hashOption = 'option'

export function isOption<V>(v: V) {
  return is$typed(v, id, hashOption)
}

export function validateOption<V>(v: V) {
  return validate<Option & V>(v, id, hashOption)
}
