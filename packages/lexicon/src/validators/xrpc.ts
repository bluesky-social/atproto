import { Lexicons } from '../lexicons'
import { LexXrpcParameters, ValidationResult, ValidationError } from '../types'

import * as PrimitiveValidators from './primitives'
import { array } from './complex'

export function params(
  lexicons: Lexicons,
  path: string,
  def: LexXrpcParameters,
  value: unknown,
): ValidationResult {
  // type
  if (!value || typeof value !== 'object') {
    // in this case, we just fall back to an object
    value = {}
  }

  // required
  if (Array.isArray(def.required)) {
    for (const key of def.required) {
      if (typeof (value as Record<string, unknown>)[key] === 'undefined') {
        return {
          success: false,
          error: new ValidationError(`${path} must have the property "${key}"`),
        }
      }
    }
  }

  // properties
  for (const key in def.properties) {
    if (typeof (value as Record<string, unknown>)[key] === 'undefined') {
      continue // skip- if required, will have already failed
    }
    const paramDef = def.properties[key]
    const val = (value as Record<string, unknown>)[key]
    const res =
      paramDef.type === 'array'
        ? array(lexicons, key, paramDef, val)
        : PrimitiveValidators.validate(lexicons, key, paramDef, val)
    if (!res.success) {
      return res
    }
  }

  return { success: true }
}
