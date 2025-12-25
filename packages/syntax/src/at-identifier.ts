import { DidString, ensureValidDidRegex } from './did.js'
import {
  HandleString,
  InvalidHandleError,
  ensureValidHandleRegex,
} from './handle.js'

export type AtIdentifierString = DidString | HandleString

export function ensureValidAtIdentifier(
  input: string,
): asserts input is AtIdentifierString {
  try {
    if (input.startsWith('did:')) {
      ensureValidDidRegex(input)
    } else {
      ensureValidHandleRegex(input)
    }
  } catch (cause) {
    throw new InvalidHandleError('Invalid DID or handle', { cause })
  }
}
