import { isValidISODateString } from 'iso-datestring-validator'
import { Lexicons } from '../lexicons'
import {
  LexUserType,
  LexBoolean,
  LexNumber,
  LexInteger,
  LexString,
  LexDatetime,
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
    case 'datetime':
      return datetime(lexicons, path, def, value)
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
  if (type == 'undefined') {
    if (typeof def.default === 'boolean') {
      return { success: true }
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

  return { success: true }
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
  if (type == 'undefined') {
    if (typeof def.default === 'number') {
      return { success: true }
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

  return { success: true }
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
  }

  // whole numbers only
  if (!Number.isInteger(value)) {
    return {
      success: false,
      error: new ValidationError(`${path} must be an integer`),
    }
  }

  return { success: true }
}

export function string(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexString

  // type
  const type = typeof value
  if (type == 'undefined') {
    if (typeof def.default === 'string') {
      return { success: true }
    }
    return {
      success: false,
      error: new ValidationError(`${path} must be a string`),
    }
  } else if (type !== 'string') {
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
    if ((value as string).length > def.maxLength) {
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
    if ((value as string).length < def.minLength) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not be shorter than ${def.minLength} characters`,
        ),
      }
    }
  }

  return { success: true }
}

export function datetime(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexDatetime

  // type
  const type = typeof value
  if (type !== 'string') {
    return {
      success: false,
      error: new ValidationError(`${path} must be a string`),
    }
  }

  // valid iso-8601
  {
    try {
      if (typeof value !== 'string' || !isValidISODateString(value)) {
        throw new ValidationError(
          `${path} must be an iso8601 formatted datetime`,
        )
      }
    } catch {
      throw new ValidationError(`${path} must be an iso8601 formatted datetime`)
    }
  }

  return { success: true }
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

  return { success: true }
}
