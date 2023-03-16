import { BlobRef, BlobRefType } from '../blob-refs'
import { Lexicons } from '../lexicons'
import { LexUserType, ValidationResult, ValidationError } from '../types'

export function blob(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
  blobType: BlobRefType = 'blob',
): ValidationResult {
  if (!value || !(value instanceof BlobRef) || value.$type !== blobType) {
    return {
      success: false,
      error: new ValidationError(`${path} should be a ${blobType} ref`),
    }
  }
  return { success: true, value }
}

export function image(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  return blob(lexicons, path, def, value, 'image')
}

export function video(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  return blob(lexicons, path, def, value, 'video')
}

export function audio(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  return blob(lexicons, path, def, value, 'audio')
}
