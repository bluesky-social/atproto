import { Lexicons } from '../lexicons'
import {
  LexArray,
  LexObject,
  LexRefVariant,
  LexUserType,
  ValidationError,
  ValidationResult,
  isDiscriminatedObject,
} from '../types'
import { toConcreteTypes, toLexUri } from '../util'

import { blob } from './blob'
import { boolean, integer, string, bytes, cidLink, unknown } from './primitives'

export function validate(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  switch (def.type) {
    case 'boolean':
      return boolean(lexicons, path, def, value)
    case 'integer':
      return integer(lexicons, path, def, value)
    case 'string':
      return string(lexicons, path, def, value)
    case 'bytes':
      return bytes(lexicons, path, def, value)
    case 'cid-link':
      return cidLink(lexicons, path, def, value)
    case 'unknown':
      return unknown(lexicons, path, def, value)
    case 'object':
      return object(lexicons, path, def, value)
    case 'array':
      return array(lexicons, path, def, value)
    case 'blob':
      return blob(lexicons, path, def, value)
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
      if (typeof value[key] === 'undefined' && !requiredProps.has(key)) {
        // Fast path for non-required undefined props.
        if (
          propDef.type === 'integer' ||
          propDef.type === 'boolean' ||
          propDef.type === 'string'
        ) {
          if (typeof propDef.default === 'undefined') {
            continue
          }
        } else {
          // Other types have no defaults.
          continue
        }
      }
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

export function validateOneOf(
  lexicons: Lexicons,
  path: string,
  def: LexRefVariant | LexUserType,
  value: unknown,
  mustBeObj = false, // this is the only type constraint we need currently (used by xrpc body schema validators)
): ValidationResult {
  let error

  let concreteDefs
  if (def.type === 'union') {
    if (!isDiscriminatedObject(value)) {
      return {
        success: false,
        error: new ValidationError(
          `${path} must be an object which includes the "$type" property`,
        ),
      }
    }
    if (!refsContainType(def.refs, value.$type)) {
      if (def.closed) {
        return {
          success: false,
          error: new ValidationError(
            `${path} $type must be one of ${def.refs.join(', ')}`,
          ),
        }
      }
      return { success: true, value }
    } else {
      concreteDefs = toConcreteTypes(lexicons, {
        type: 'ref',
        ref: value.$type,
      })
    }
  } else {
    concreteDefs = toConcreteTypes(lexicons, def)
  }

  for (const concreteDef of concreteDefs) {
    const result = mustBeObj
      ? object(lexicons, path, concreteDef, value)
      : validate(lexicons, path, concreteDef, value)
    if (result.success) {
      return result
    }
    error ??= result.error
  }
  if (concreteDefs.length > 1) {
    return {
      success: false,
      error: new ValidationError(
        `${path} did not match any of the expected definitions`,
      ),
    }
  }
  return { success: false, error }
}

// to avoid bugs like #0189 this needs to handle both
// explicit and implicit #main
const refsContainType = (refs: string[], type: string) => {
  const lexUri = toLexUri(type)
  if (refs.includes(lexUri)) {
    return true
  }

  if (lexUri.endsWith('#main')) {
    return refs.includes(lexUri.replace('#main', ''))
  } else {
    return refs.includes(lexUri + '#main')
  }
}
