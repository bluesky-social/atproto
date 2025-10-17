import * as manifest from '../../manifest.json'

// This list is generated from the list of lexicons in the ./lexicons directory
const ATPROTO_LEXICONS = new Set<string>(manifest.lexicons)

export function isAtprotoLexicon(id: string) {
  return ATPROTO_LEXICONS.has(id)
}
