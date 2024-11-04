import { utf8Len, graphemeLen } from '@atproto/common-web'
import { CID } from 'multiformats/cid'
import { Lexicons } from '../lexicons'
import * as formats from './formats'
import {
  LexUserType,
  LexBoolean,
  LexInteger,
  LexString,
  ValidationResult,
  ValidationError,
  LexBytes,
} from '../types'

export function validate(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  switch (def.type) {
    case 'boolean':
      return boolean(lexicons, path, def, value)
    case 'integer':
      return integer(lexicons, path, def, value)
    case 'string':
      return string(lexicons, path, def, value)
    case 'bytes':
      return bytes(lexicons, path, def, value)
    case 'cid-link':
      return cidLink(lexicons, path, def, value)
    case 'unknown':
      return unknown(lexicons, path, def, value)
    default:
      return {
        success: false,
        error: new ValidationError(`Unexpected lexicon type: ${def.type}`),
      }
  }
}

export function boolean(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexBoolean

  // type
  const type = typeof value
  if (type === 'undefined') {
    if (typeof def.default === 'boolean') {
      return { success: true, value: def.default }
    }
    return {
      success: false,
      error: new ValidationError(`${path} must be a boolean`),
    }
  } else if (type !== 'boolean') {
    return {
      success: false,
      error: new ValidationError(`${path} must be a boolean`),
    }
  }

  // const
  if (typeof def.const === 'boolean') {
    if (value !== def.const) {
      return {
        success: false,
        error: new ValidationError(`${path} must be ${def.const}`),
      }
    }
  }

  return { success: true, value }
}

export function integer(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexInteger

  // type
  const type = typeof value
  if (type === 'undefined') {
    if (typeof def.default === 'number') {
      return { success: true, value: def.default }
    }
    return {
      success: false,
      error: new ValidationError(`${path} must be an integer`),
    }
  } else if (!Number.isInteger(value)) {
    return {
      success: false,
      error: new ValidationError(`${path} must be an integer`),
    }
  }

  // const
  if (typeof def.const === 'number') {
    if (value !== def.const) {
      return {
        success: false,
        error: new ValidationError(`${path} must be ${def.const}`),
      }
    }
  }

  // enum
  if (Array.isArray(def.enum)) {
    if (!def.enum.includes(value as number)) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must be one of (${def.enum.join('|')})`,
        ),
      }
    }
  }

  // maximum
  if (typeof def.maximum === 'number') {
    if ((value as number) > def.maximum) {
      return {
        success: false,
        error: new ValidationError(
          `${path} can not be greater than ${def.maximum}`,
        ),
      }
    }
  }

  // minimum
  if (typeof def.minimum === 'number') {
    if ((value as number) < def.minimum) {
      return {
        success: false,
        error: new ValidationError(
          `${path} can not be less than ${def.minimum}`,
        ),
      }
    }
  }

  return { success: true, value }
}

export function string(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexString

  // type
  if (typeof value === 'undefined') {
    if (typeof def.default === 'string') {
      return { success: true, value: def.default }
    }
    return {
      success: false,
      error: new ValidationError(`${path} must be a string`),
    }
  } else if (typeof value !== 'string') {
    return {
      success: false,
      error: new ValidationError(`${path} must be a string`),
    }
  }

  // const
  if (typeof def.const === 'string') {
    if (value !== def.const) {
      return {
        success: false,
        error: new ValidationError(`${path} must be ${def.const}`),
      }
    }
  }

  // enum
  if (Array.isArray(def.enum)) {
    if (!def.enum.includes(value as string)) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must be one of (${def.enum.join('|')})`,
        ),
      }
    }
  }

  // maxLength and minLength
  if (typeof def.maxLength === 'number' || typeof def.minLength === 'number') {
    const len = utf8Len(value)

    if (typeof def.maxLength === 'number') {
      if (len > def.maxLength) {
        return {
          success: false,
          error: new ValidationError(
            `${path} must not be longer than ${def.maxLength} characters`,
          ),
        }
      }
    }

    if (typeof def.minLength === 'number') {
      if (len < def.minLength) {
        return {
          success: false,
          error: new ValidationError(
            `${path} must not be shorter than ${def.minLength} characters`,
          ),
        }
      }
    }
  }

  // maxGraphemes and minGraphemes
  if (
    typeof def.maxGraphemes === 'number' ||
    typeof def.minGraphemes === 'number'
  ) {
    let needsMaxGraphemesCheck = false
    let needsMinGraphemesCheck = false

    if (typeof def.maxGraphemes === 'number') {
      if (value.length <= def.maxGraphemes) {
        // If the JavaScript string length (UTF-16) is within the maximum limit,
        // its grapheme length (which <= .length) will also be within.
        needsMaxGraphemesCheck = false
      } else {
        needsMaxGraphemesCheck = true
      }
    }

    if (typeof def.minGraphemes === 'number') {
      if (value.length < def.minGraphemes) {
        // If the JavaScript string length (UTF-16) is below the minimal limit,
        // its grapheme length (which <= .length) will also be below.
        // Fail early.
        return {
          success: false,
          error: new ValidationError(
            `${path} must not be shorter than ${def.minGraphemes} graphemes`,
          ),
        }
      } else {
        needsMinGraphemesCheck = true
      }
    }

    if (needsMaxGraphemesCheck || needsMinGraphemesCheck) {
      const len = graphemeLen(value)

      if (typeof def.maxGraphemes === 'number') {
        if (len > def.maxGraphemes) {
          return {
            success: false,
            error: new ValidationError(
              `${path} must not be longer than ${def.maxGraphemes} graphemes`,
            ),
          }
        }
      }

      if (typeof def.minGraphemes === 'number') {
        if (len < def.minGraphemes) {
          return {
            success: false,
            error: new ValidationError(
              `${path} must not be shorter than ${def.minGraphemes} graphemes`,
            ),
          }
        }
      }
    }
  }

  if (typeof def.format === 'string') {
    switch (def.format) {
      case 'datetime':
        return formats.datetime(path, value)
      case 'uri':
        return formats.uri(path, value)
      case 'at-uri':
        return formats.atUri(path, value)
      case 'did':
        return formats.did(path, value)
      case 'handle':
        return formats.handle(path, value)
      case 'at-identifier':
        return formats.atIdentifier(path, value)
      case 'nsid':
        return formats.nsid(path, value)
      case 'cid':
        return formats.cid(path, value)
      case 'language':
        return formats.language(path, value)
      case 'tid':
        return formats.tid(path, value)
      case 'record-key':
        return formats.recordKey(path, value)
    }
  }

  return { success: true, value }
}

export function bytes(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexBytes

  if (!value || !(value instanceof Uint8Array)) {
    return {
      success: false,
      error: new ValidationError(`${path} must be a byte array`),
    }
  }

  // maxLength
  if (typeof def.maxLength === 'number') {
    if (value.byteLength > def.maxLength) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not be larger than ${def.maxLength} bytes`,
        ),
      }
    }
  }

  // minLength
  if (typeof def.minLength === 'number') {
    if (value.byteLength < def.minLength) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not be smaller than ${def.minLength} bytes`,
        ),
      }
    }
  }

  return { success: true, value }
}

export function cidLink(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  if (CID.asCID(value) === null) {
    return {
      success: false,
      error: new ValidationError(`${path} must be a CID`),
    }
  }

  return { success: true, value }
}

export function unknown(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  // type
  if (!value || typeof value !== 'object') {
    return {
      success: false,
      error: new ValidationError(`${path} must be an object`),
    }
  }

  return { success: true, value }
}
