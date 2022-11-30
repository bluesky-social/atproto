import { Lexicons } from '../lexicons'
import { LexXrpcParameters, ValidationResult } from '../types'

import * as PrimitiveValidators from './primitives'

export function params(
  lexicons: Lexicons,
  path: string,
  def: LexXrpcParameters,
  value: unknown,
): ValidationResult {
  def = def as LexXrpcParameters

  // type
  if (!value || typeof value !== 'object') {
    // in this case, we just fall back to an object
    value = {}
  }

  // params
  for (const key in def) {
    if (typeof (value as Record<string, unknown>)[key] === 'undefined') {
      continue // all params are optional
    }
    const paramDef = def[key]
    const res = PrimitiveValidators.validate(
      lexicons,
      key,
      paramDef,
      (value as Record<string, unknown>)[key],
    )
    if (!res.success) {
      return res
    }
  }

  return { success: true }
}
