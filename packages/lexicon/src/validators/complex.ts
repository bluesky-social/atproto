import { Lexicons } from '../lexicons'
import {
  LexArray,
  LexObject,
  LexUserType,
  ValidationResult,
  ValidationError,
} from '../types'
import { validateOneOf } from '../util'

import * as Primitives from './primitives'
import * as Blob from './blob'

export function validate(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  switch (def.type) {
    case 'boolean':
      return Primitives.boolean(lexicons, path, def, value)
    case 'integer':
      return Primitives.integer(lexicons, path, def, value)
    case 'string':
      return Primitives.string(lexicons, path, def, value)
    case 'bytes':
      return Primitives.bytes(lexicons, path, def, value)
    case 'cid-link':
      return Primitives.cidLink(lexicons, path, def, value)
    case 'unknown':
      return Primitives.unknown(lexicons, path, def, value)
    case 'object':
      return object(lexicons, path, def, value)
    case 'array':
      return array(lexicons, path, def, value)
    case 'blob':
      return Blob.blob(lexicons, path, def, value)
    default:
      return {
        success: false,
        error: new ValidationError(`Unexpected lexicon type: ${def.type}`),
      }
  }
}

export function array(
  lexicons: Lexicons,
  path: string,
  def: LexArray,
  value: unknown,
): ValidationResult {
  // type
  if (!Array.isArray(value)) {
    return {
      success: false,
      error: new ValidationError(`${path} must be an array`),
    }
  }

  // maxLength
  if (typeof def.maxLength === 'number') {
    if ((value as Array<unknown>).length > def.maxLength) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not have more than ${def.maxLength} elements`,
        ),
      }
    }
  }

  // minLength
  if (typeof def.minLength === 'number') {
    if ((value as Array<unknown>).length < def.minLength) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must not have fewer than ${def.minLength} elements`,
        ),
      }
    }
  }

  // items
  const itemsDef = def.items
  for (let i = 0; i < (value as Array<unknown>).length; i++) {
    const itemValue = value[i]
    const itemPath = `${path}/${i}`
    const res = validateOneOf(lexicons, itemPath, itemsDef, itemValue)
    if (!res.success) {
      return res
    }
  }

  return { success: true, value }
}

export function object(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexObject

  // type
  if (!value || typeof value !== 'object') {
    return {
      success: false,
      error: new ValidationError(`${path} must be an object`),
    }
  }

  const requiredProps = new Set(def.required)
  const nullableProps = new Set(def.nullable)

  // properties
  let resultValue = value
  if (typeof def.properties === 'object') {
    for (const key in def.properties) {
      if (value[key] === null && nullableProps.has(key)) {
        continue
      }
      const propDef = def.properties[key]
      const propPath = `${path}/${key}`
      const validated = validateOneOf(lexicons, propPath, propDef, value[key])
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
