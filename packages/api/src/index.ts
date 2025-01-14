import { Lexicons } from '@atproto/lexicon'
import { lexicons as internalLexicons } from './client/lexicons'

export { AtUri } from '@atproto/syntax'
export {
  BlobRef,
  lexToJson,
  stringifyLex,
  jsonToLex,
  jsonStringToLex,
} from '@atproto/lexicon'
export { parseLanguage } from '@atproto/common-web'
export * from './types'
export * from './const'
export * from './util'
export * from './client'
export { schemas } from './client/lexicons'
export * from './rich-text/rich-text'
export * from './rich-text/sanitization'
export * from './rich-text/unicode'
export * from './rich-text/util'
export * from './moderation'
export * from './moderation/types'
export * from './mocker'
export { LABELS, DEFAULT_LABEL_SETTINGS } from './moderation/const/labels'
export { Agent } from './agent'

export { AtpAgent, type AtpAgentOptions } from './atp-agent'
export { CredentialSession } from './atp-agent'
export { BskyAgent } from './bsky-agent'

export {
  /** @deprecated */
  AtpAgent as default,
} from './atp-agent'

// Expose a copy to prevent alteration of the internal Lexicon instance used by
// the AtpBaseClient class.
export const lexicons = new Lexicons(internalLexicons)
