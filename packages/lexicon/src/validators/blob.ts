import { jsonBlobRef, BlobRef } from '../blob-refs'
import { Lexicons } from '../lexicons'
import { LexUserType, ValidationError, ValidationResult } from '../types'

export function blob(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  // check
  if (value instanceof BlobRef) {
    return { success: true, value }
  }

  if (jsonBlobRef.safeParse(value).success) {
    return { success: true, value }
  }

  return {
    success: false,
    error: new ValidationError(`${path} should be a blob ref`),
  }
}
