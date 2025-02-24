import { Lexicons } from '../lexicons'
import {
  LexArray,
  LexRefVariant,
  LexUserType,
  ValidationError,
  ValidationResult,
  isDiscriminatedObject,
  isObj,
} from '../types'
import { toLexUri } from '../util'
import { blob } from './blob'
import { validate as validatePrimitive } from './primitives'

export function validate(
  lexicons: Lexicons,
  path: string,
  def: LexUserType,
  value: unknown,
): ValidationResult {
  switch (def.type) {
    case 'object':
      return object(lexicons, path, def, value)
    case 'array':
      return array(lexicons, path, def, value)
    case 'blob':
      return blob(lexicons, path, def, value)
    default:
      return validatePrimitive(lexicons, path, def, value)
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
  // type
  if (!isObj(value)) {
    return {
      success: false,
      error: new ValidationError(`${path} must be an object`),
    }
  }

  // properties
  let resultValue = value
  if ('properties' in def && def.properties != null) {
    for (const key in def.properties) {
      const keyValue = value[key]
      if (keyValue === null && def.nullable?.includes(key)) {
        continue
      }
      const propDef = def.properties[key]
      if (keyValue === undefined && !def.required?.includes(key)) {
        // Fast path for non-required undefined props.
        if (
          propDef.type === 'integer' ||
          propDef.type === 'boolean' ||
          propDef.type === 'string'
        ) {
          if (propDef.default === undefined) {
            continue
          }
        } else {
          // Other types have no defaults.
          continue
        }
      }
      const propPath = `${path}/${key}`
      const validated = validateOneOf(lexicons, propPath, propDef, keyValue)
      const propValue = validated.success ? validated.value : keyValue

      // Return error for bad validation, giving required rule precedence
      if (propValue === undefined) {
        if (def.required?.includes(key)) {
          return {
            success: false,
            error: new ValidationError(
              `${path} must have the property "${key}"`,
            ),
          }
        }
      } else {
        if (!validated.success) {
          return validated
        }
      }

      // Adjust value based on e.g. applied defaults, cloning shallowly if there was a changed value
      if (propValue !== keyValue) {
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
  let concreteDef: LexUserType

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
      concreteDef = lexicons.getDefOrThrow(value.$type)
    }
  } else if (def.type === 'ref') {
    concreteDef = lexicons.getDefOrThrow(def.ref)
  } else {
    concreteDef = def
  }

  return mustBeObj
    ? object(lexicons, path, concreteDef, value)
    : validate(lexicons, path, concreteDef, value)
}

// to avoid bugs like #0189 this needs to handle both
// explicit and implicit #main
const refsContainType = (refs: string[], type: string) => {
  const lexUri = toLexUri(type)
  if (refs.includes(lexUri)) {
    return true
  }

  if (lexUri.endsWith('#main')) {
    return refs.includes(lexUri.slice(0, -5))
  } else {
    return !lexUri.includes('#') && refs.includes(`${lexUri}#main`)
  }
}
