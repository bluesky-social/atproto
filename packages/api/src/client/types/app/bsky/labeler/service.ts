/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { isObj, hasProp } from '../../../../util.js'
import { lexicons } from '../../../../lexicons.js'
import * as AppBskyLabelerDefs from './defs.js'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'

export interface Record {
  policies: AppBskyLabelerDefs.LabelerPolicies
  labels?:
    | ComAtprotoLabelDefs.SelfLabels
    | { $type: string; [k: string]: unknown }
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.labeler.service#main' ||
      v.$type === 'app.bsky.labeler.service')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.labeler.service#main', v)
}
