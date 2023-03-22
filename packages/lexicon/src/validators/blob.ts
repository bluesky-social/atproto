import { BlobRef } from '../blob-refs'
import { Lexicons } from '../lexicons'
import { LexUserType, ValidationResult, ValidationError } from '../types'

export function blob(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  // check
  if (!value || !(value instanceof BlobRef)) {
    return {
      success: false,
      error: new ValidationError(`${path} should be a blob ref`),
    }
  }
  return { success: true, value }
}
