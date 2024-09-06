/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface TemplateView {
  id: string
  /** Name of the template. */
  name: string
  /** Content of the template, can contain markdown and variable placeholders. */
  subject?: string
  /** Subject of the message, used in emails. */
  contentMarkdown: string
  disabled: boolean
  /** Message language. */
  lang?: string
  /** DID of the user who last updated the template. */
  lastUpdatedBy: string
  createdAt: string
  updatedAt: string
  [k: string]: unknown
}

export function isTemplateView(v: unknown): v is TemplateView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.communication.defs#templateView'
  )
}

export function validateTemplateView(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.communication.defs#templateView', v)
}
