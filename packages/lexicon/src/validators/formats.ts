import { CID } from 'multiformats/cid'
import {
  isAtIdentifierString,
  isAtUriString,
  isDatetimeStringLenient,
  isValidDid,
  isValidHandle,
  isValidLanguage,
  isValidNsid,
  isValidRecordKey,
  isValidTid,
  isValidUri,
} from '@atproto/syntax'
import { ValidationError, ValidationResult } from '../types.js'

export const datetime = createValidator(
  isDatetimeStringLenient,
  'must be an valid atproto datetime (both RFC-3339 and ISO-8601)',
)
export const uri = createValidator(isValidUri, 'must be a uri')
export const atUri = createValidator(isAtUriString, 'must be a valid at-uri')
export const did = createValidator(isValidDid, 'must be a valid did')
export const handle = createValidator(isValidHandle, 'must be a valid handle')
export const atIdentifier = createValidator(
  isAtIdentifierString,
  'must be a valid did or a handle',
)
export const nsid = createValidator(isValidNsid, 'must be a valid nsid')
export const cid = createValidator(isCidString, 'must be a cid string')
export const language = createValidator(
  isValidLanguage,
  'must be a well-formed BCP 47 language tag',
)
export const tid = createValidator(isValidTid, 'must be a valid TID')
export const recordKey = createValidator(
  isValidRecordKey,
  'must be a valid Record Key',
)

// Internal helpers

function createValidator<T extends string>(
  assertionFn: (value: string) => value is T,
  errorMessage: string,
): <V extends string>(path: string, value: V) => ValidationResult<V & T>
function createValidator(
  assertionFn: (value: string) => boolean,
  errorMessage: string,
): (path: string, value: string) => ValidationResult<string>
function createValidator(
  assertionFn: (value: string) => boolean,
  errorMessage: string,
) {
  return (path: string, value: string): ValidationResult => {
    if (assertionFn(value)) {
      return { success: true, value }
    }
    return {
      success: false,
      error: new ValidationError(`${path} ${errorMessage}`),
    }
  }
}

function isCidString(v: string): v is string {
  try {
    CID.parse(v)
    return true
  } catch {
    return false
  }
}
