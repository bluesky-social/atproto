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
    case 'number':
      return Primitives.number(lexicons, path, def, value)
    case 'integer':
      return Primitives.integer(lexicons, path, def, value)
    case 'string':
      return Primitives.string(lexicons, path, def, value)
    case 'datetime':
      return Primitives.datetime(lexicons, path, def, value)
    case 'unknown':
      return Primitives.unknown(lexicons, path, def, value)
    case 'object':
      return object(lexicons, path, def, value)
    case 'array':
      return array(lexicons, path, def, value)
    case 'blob':
      return Blob.blob(lexicons, path, def, value)
    case 'image':
      return Blob.image(lexicons, path, def, value)
    case 'video':
      return Blob.video(lexicons, path, def, value)
    case 'audio':
      return Blob.audio(lexicons, path, def, value)
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
  def: LexUserType,
  value: unknown,
): ValidationResult {
  def = def as LexArray

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

  return { success: true }
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

  // required
  if (Array.isArray(def.required)) {
    for (const key of def.required) {
      if (!(key in value)) {
        return {
          success: false,
          error: new ValidationError(`${path} must have the property "${key}"`),
        }
      }
    }
  }

  // properties
  if (typeof def.properties === 'object') {
    for (const key in def.properties) {
      const propValue = value[key]
      if (typeof propValue === 'undefined') {
        continue // skip- if required, will have already failed
      }
      const propDef = def.properties[key]
      const propPath = `${path}/${key}`
      const res = validateOneOf(lexicons, propPath, propDef, propValue)
      if (!res.success) {
        return res
      }
    }
  }

  return { success: true }
}
