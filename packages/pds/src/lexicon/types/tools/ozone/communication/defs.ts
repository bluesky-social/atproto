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
const id = 'tools.ozone.communication.defs'

export interface TemplateView {
  $type?: 'tools.ozone.communication.defs#templateView'
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

const hashTemplateView = 'templateView'

export function isTemplateView<V>(v: V) {
  return is$typed(v, id, hashTemplateView)
}

export function validateTemplateView<V>(v: V) {
  return validate<TemplateView & V>(v, id, hashTemplateView)
}
