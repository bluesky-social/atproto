import { Lexicons } from '@atproto/lexicon'
import { lexicons as internalLexicons } from './client/lexicons.js'

export { AtUri } from '@atproto/syntax'
export {
  BlobRef,
  jsonStringToLex,
  jsonToLex,
  lexToJson,
  stringifyLex,
} from '@atproto/lexicon'
export { parseLanguage } from '@atproto/common-web'
export { XRPCError } from '@atproto/xrpc'

export * from './types.js'
export * from './const.js'
export * from './util.js'
export * from './client/index.js'
export { ids, schemas } from './client/lexicons.js'
export type { $Typed, Un$Typed } from './client/util.js'
export { asPredicate } from './client/util.js'
export * from './rich-text/rich-text.js'
export * from './rich-text/sanitization.js'
export * from './rich-text/unicode.js'
export * from './rich-text/util.js'
export * from './moderation/index.js'
export * from './moderation/types.js'
export * from './mocker.js'
export * from './age-assurance.js'
export { DEFAULT_LABEL_SETTINGS, LABELS } from './moderation/const/labels.js'
export { Agent } from './agent.js'

export { AtpAgent, type AtpAgentOptions } from './atp-agent.js'
export { CredentialSession } from './atp-agent.js'
export { BskyAgent } from './bsky-agent.js'

export {
  /** @deprecated */
  AtpAgent as default,
} from './atp-agent.js'

// Expose a copy to prevent alteration of the internal Lexicon instance used by
// the AtpBaseClient class.
export const lexicons = new Lexicons(internalLexicons)
