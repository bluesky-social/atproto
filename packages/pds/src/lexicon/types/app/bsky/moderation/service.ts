/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyModerationDefs from './defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export interface Record {
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  policies: AppBskyModerationDefs.ModServicePolicies
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
    (v.$type === 'app.bsky.moderation.service#main' ||
      v.$type === 'app.bsky.moderation.service')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.moderation.service#main', v)
}
