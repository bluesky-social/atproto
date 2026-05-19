import { BlobRef } from '../blob-refs.js'
import { Lexicons } from '../lexicons.js'
import { LexUserType, ValidationError, ValidationResult } from '../types.js'

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
