import { BlobRef } from '../blob-refs.ts'
import { Lexicons } from '../lexicons.ts'
import {
  type LexUserType,
  ValidationError,
  type ValidationResult,
} from '../types.ts'

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
