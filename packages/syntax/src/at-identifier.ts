import { DidString, ensureValidDidRegex } from './did.js'
import { HandleString, ensureValidHandleRegex } from './handle.js'

export type AtIdentifierString = DidString | HandleString

export function ensureValidAtIdentifier(
  input: string,
): asserts input is AtIdentifierString {
  if (input.startsWith('did:')) {
    ensureValidDidRegex(input)
  } else {
    ensureValidHandleRegex(input)
  }
}
