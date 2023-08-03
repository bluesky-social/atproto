/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../util'
import { lexicons } from '../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../app/bsky/richtext/facet'
import * as ComAtprotoRepoStrongRef from '../../com/atproto/repo/strongRef'

export interface Record {
  text: string
  facets?: AppBskyRichtextFacet.Main[]
  subject?: ComAtprotoRepoStrongRef.Main
  langs?: string[]
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'social.waverly.miniblog#main' ||
      v.$type === 'social.waverly.miniblog')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('social.waverly.miniblog#main', v)
}
