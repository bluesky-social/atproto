import { AtUri } from '@atproto/uri'
import * as common from '@atproto/common'
import { isValidISODateString } from 'iso-datestring-validator'
import { CID } from 'multiformats/cid'
import { Lexicons } from '../lexicons'
import {
  LexUserType,
  LexBoolean,
  LexNumber,
  LexInteger,
  LexString,
  ValidationResult,
  ValidationError,
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
    case 'number':
      return number(lexicons, path, def, value)
    case 'integer':
      return integer(lexicons, path, def, value)
    case 'string':
      return string(lexicons, path, def, value)
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

export function number(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexNumber

  // type
  const type = typeof value
  if (type === 'undefined') {
    if (typeof def.default === 'number') {
      return { success: true, value: def.default }
    }
    return {
      success: false,
      error: new ValidationError(`${path} must be a number`),
    }
  } else if (type !== 'number') {
    return {
      success: false,
      error: new ValidationError(`${path} must be a number`),
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

export function integer(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexInteger

  // run number validation
  const numRes = number(lexicons, path, def, value)
  if (!numRes.success) {
    return numRes
  } else {
    value = numRes.value
  }

  // whole numbers only
  if (!Number.isInteger(value)) {
    return {
      success: false,
      error: new ValidationError(`${path} must be an integer`),
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

  // maxLength
  if (typeof def.maxLength === 'number') {
    if (common.graphemeLen(value) > def.maxLength) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not be longer than ${def.maxLength} characters`,
        ),
      }
    }
  }

  // minLength
  if (typeof def.minLength === 'number') {
    if (common.graphemeLen(value) < def.minLength) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not be shorter than ${def.minLength} characters`,
        ),
      }
    }
  }

  // maxUtf8
  if (typeof def.maxUtf8 === 'number') {
    if (common.utf8Len(value) > def.maxUtf8) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not be longer than ${def.maxUtf8} characters utf8`,
        ),
      }
    }
  }

  // minUtf8
  if (typeof def.minUtf8 === 'number') {
    if (common.utf8Len(value) < def.minUtf8) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not be shorter than ${def.minUtf8} characters utf8`,
        ),
      }
    }
  }

  if (typeof def.format === 'string') {
    switch (def.format) {
      case 'datetime':
        return datetimeFormat(path, value)
      case 'at-uri':
        return atUriFormat(path, value)
      case 'did':
        return didFormat(path, value)
      case 'cid':
        return cidFormat(path, value)
    }
  }

  return { success: true, value }
}

export function datetimeFormat(path: string, value: string): ValidationResult {
  try {
    if (!isValidISODateString(value)) {
      throw new Error()
    }
  } catch {
    return {
      success: false,
      error: new ValidationError(
        `${path} must be an iso8601 formatted datetime`,
      ),
    }
  }
  return { success: true, value }
}

export function atUriFormat(path: string, value: string): ValidationResult {
  try {
    if (!value.startsWith('at://')) {
      throw new Error()
    }
    const uri = new AtUri(value)
    if (!uri.host) {
      throw new Error()
    }
  } catch {
    return {
      success: false,
      error: new ValidationError(`${path} must be an at-uri`),
    }
  }
  return { success: true, value }
}

export function didFormat(path: string, value: string): ValidationResult {
  const parts = value.split(':')
  if (parts[0] !== 'did' || !parts[1] || !parts[2]) {
    return {
      success: false,
      error: new ValidationError(`${path} must be a did`),
    }
  }
  return { success: true, value }
}

export function cidFormat(path: string, value: string): ValidationResult {
  try {
    CID.parse(value)
  } catch {
    return {
      success: false,
      error: new ValidationError(`${path} must be a cid`),
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
