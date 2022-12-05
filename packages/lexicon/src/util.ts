import { Lexicons } from './lexicons'
import {
  LexUserType,
  LexRefVariant,
  ValidationError,
  ValidationResult,
} from './types'

export function toLexUri(str: string, baseUri?: string): string {
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

export function validateOneOf<T>(
  path: string,
  items: Array<T>,
  mapFn: (T) => ValidationResult,
): ValidationResult {
  let error
  for (const item of items) {
    const result = mapFn(item)
    if (result.success) {
      return result
    }
    error ??= result.error
  }
  if (items.length > 1) {
    return {
      success: false,
      error: new ValidationError(
        `${path} did not match any of the expected definitions`,
      ),
    }
  }
  return { success: false, error }
}

export function assertValidOneOf<T>(
  path: string,
  items: Array<T>,
  mapFn: (T) => ValidationResult,
) {
  const res = validateOneOf(path, items, mapFn)
  if (!res.success) {
    throw res.error
  }
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
