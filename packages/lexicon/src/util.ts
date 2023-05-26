import { Lexicons } from './lexicons'
import * as ComplexValidators from './validators/complex'
import {
  LexUserType,
  LexRefVariant,
  ValidationError,
  ValidationResult,
  isDiscriminatedObject,
} from './types'
import { z } from 'zod'

export function toLexUri(str: string, baseUri?: string): string {
  if (str.split('#').length > 2) {
    throw new Error('Uri can only have one hash segment')
  }

  if (str.startsWith('lex:')) {
    return str
  }
  if (str.startsWith('#')) {
    if (!baseUri) {
      throw new Error(`Unable to resolve uri without anchor: ${str}`)
    }
    return `${baseUri}${str}`
  }
  return `lex:${str}`
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
      ? ComplexValidators.object(lexicons, path, concreteDef, value)
      : ComplexValidators.validate(lexicons, path, concreteDef, value)
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

export function assertValidOneOf(
  lexicons: Lexicons,
  path: string,
  def: LexRefVariant | LexUserType,
  value: unknown,
  mustBeObj = false,
) {
  const res = validateOneOf(lexicons, path, def, value, mustBeObj)
  if (!res.success) throw res.error
  return res.value
}

export function toConcreteTypes(
  lexicons: Lexicons,
  def: LexRefVariant | LexUserType,
): LexUserType[] {
  if (def.type === 'ref') {
    return [lexicons.getDefOrThrow(def.ref)]
  } else if (def.type === 'union') {
    return def.refs.map((ref) => lexicons.getDefOrThrow(ref)).flat()
  } else {
    return [def]
  }
}

export function requiredPropertiesRefinement<
  ObjectType extends {
    required?: string[]
    properties?: Record<string, unknown>
  },
>(object: ObjectType, ctx: z.RefinementCtx) {
  // Required fields check
  if (object.required === undefined) {
    return
  }

  if (!Array.isArray(object.required)) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      received: typeof object.required,
      expected: 'array',
    })
    return
  }

  if (object.properties === undefined) {
    if (object.required.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Required fields defined but no properties defined`,
      })
    }
    return
  }

  for (const field of object.required) {
    if (object.properties[field] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Required field "${field}" not defined`,
      })
    }
  }
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
