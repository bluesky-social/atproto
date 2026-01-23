import { DidString, ensureValidDidRegex, isValidDid } from './did.js'
import {
  HandleString,
  InvalidHandleError,
  ensureValidHandleRegex,
  isValidHandle,
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

export function isValidAtIdentifier<I extends string>(
  input: I,
): input is I & AtIdentifierString {
  if (input.startsWith('did:')) {
    return isValidDid(input)
  } else {
    return isValidHandle(input)
  }
}
