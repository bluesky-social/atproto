/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'tools.ozone.communication.defs'

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

export function isTemplateView(v: unknown): v is TemplateView & {
  $type: $Type<'tools.ozone.communication.defs', 'templateView'>
} {
  return is$typed(v, id, 'templateView')
}

export function validateTemplateView(v: unknown) {
  return lexicons.validate(
    `${id}#templateView`,
    v,
  ) as ValidationResult<TemplateView>
}
