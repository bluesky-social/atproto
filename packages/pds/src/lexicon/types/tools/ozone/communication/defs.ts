/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'tools.ozone.communication.defs'

export interface TemplateView {
  $type?: $Type<'tools.ozone.communication.defs', 'templateView'>
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
}

export function isTemplateView<V>(v: V) {
  return is$typed(v, id, 'templateView')
}

export function validateTemplateView(v: unknown) {
  return lexicons.validate(
    `${id}#templateView`,
    v,
  ) as ValidationResult<TemplateView>
}

export function isValidTemplateView<V>(v: V): v is V & $Typed<TemplateView> {
  return isTemplateView(v) && validateTemplateView(v).success
}
