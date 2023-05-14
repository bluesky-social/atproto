import { Lexicons } from '../lexicons'
import {
  LexXrpcParameters,
  ValidationResult,
  ValidationError,
  LexXrpcParametersProperty,
  LexUserType,
} from '../types'

import * as PrimitiveValidators from './primitives'
import { array } from './complex'
import { validateOneOf } from '../util'

export const PROPERTY_VALID_REF_TYPES: Array<LexUserType['type']> = [
  'string',
  'integer',
  'boolean',
]

function property(
  property: LexXrpcParametersProperty,
  lexicons: Lexicons,
  value: object,
  key: string,
): ValidationResult {
  if (property.type === 'array') {
    return array(lexicons, key, property, value[key])
  }

  if (property.type === 'ref') {
    return validateOneOf(
      lexicons,
      key,
      property,
      value[key],
      PROPERTY_VALID_REF_TYPES,
    )
  }

  return PrimitiveValidators.validate(lexicons, key, property, value[key])
}

export function params(
  lexicons: Lexicons,
  path: string,
  def: LexXrpcParameters,
  val: unknown,
): ValidationResult {
  // type
  const value = val && typeof val === 'object' ? val : {}

  const requiredProps = new Set(def.required ?? [])

  // properties
  let resultValue = value
  if (typeof def.properties === 'object') {
    for (const key in def.properties) {
      const propDef = def.properties[key]
      const validated = property(propDef, lexicons, value, key)
      const propValue = validated.success ? validated.value : value[key]
      const propIsUndefined = typeof propValue === 'undefined'
      // Return error for bad validation, giving required rule precedence
      if (propIsUndefined && requiredProps.has(key)) {
        return {
          success: false,
          error: new ValidationError(`${path} must have the property "${key}"`),
        }
      } else if (!propIsUndefined && !validated.success) {
        return validated
      }
      // Adjust value based on e.g. applied defaults, cloning shallowly if there was a changed value
      if (propValue !== value[key]) {
        if (resultValue === value) {
          // Lazy shallow clone
          resultValue = { ...value }
        }
        resultValue[key] = propValue
      }
    }
  }

  return { success: true, value: resultValue }
}
