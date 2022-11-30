import { Lexicons } from '../lexicons'
import { LexUserType, ValidationResult, ValidationError } from '../types'
import { isObj, hasProp } from '../types'

export function blob(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  if (!isObj(value)) {
    return {
      success: false,
      error: new ValidationError(`${path} should be an object`),
    }
  }
  if (!hasProp(value, 'cid') || typeof value.cid !== 'string') {
    return {
      success: false,
      error: new ValidationError(`${path}/cid should be a string`),
    }
  }
  if (!hasProp(value, 'mimeType') || typeof value.mimeType !== 'string') {
    return {
      success: false,
      error: new ValidationError(`${path}/mimeType should be a string`),
    }
  }
  return { success: true }
}

export function image(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  return blob(lexicons, path, def, value)
}

export function video(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  return blob(lexicons, path, def, value)
}

export function audio(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  return blob(lexicons, path, def, value)
}
