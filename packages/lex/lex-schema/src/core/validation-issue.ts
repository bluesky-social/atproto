import { ifCid, isLegacyBlobRef, isPlainObject } from '@atproto/lex-data'
import { PropertyKey } from './property-key.js'

/**
 * Abstract base class for all validation issues.
 *
 * An issue represents a single validation failure, containing:
 * - A code identifying the type of issue
 * - The path to the invalid value in the data structure
 * - The actual input value that failed validation
 *
 * Subclasses add specific properties relevant to each issue type and
 * implement the {@link toString} method for human-readable error messages.
 */
export abstract class Issue {
  constructor(
    readonly code: string,
    readonly path: readonly PropertyKey[],
    readonly input: unknown,
  ) {}

  /**
   * Returns a human-readable description of the validation issue.
   */
  abstract toString(): string

  /**
   * Converts the issue to a JSON-serializable object.
   *
   * @returns An object containing the issue code, path, and message
   */
  toJSON() {
    return {
      code: this.code,
      path: this.path,
      message: this.toString(),
    }
  }
}

/**
 * A custom validation issue with a user-defined message.
 *
 * Use this for validation rules that don't fit into the standard issue categories.
 */
export class IssueCustom extends Issue {
  constructor(
    readonly path: readonly PropertyKey[],
    readonly input: unknown,
    readonly message: string,
  ) {
    super('custom', path, input)
  }

  toString() {
    return `${this.message}${stringifyPath(this.path)}`
  }
}

/**
 * Issue for string values that don't match an expected format.
 *
 * Used for AT Protocol specific formats like DID, handle, NSID, AT-URI, etc.
 */
export class IssueInvalidFormat extends Issue {
  constructor(
    path: readonly PropertyKey[],
    input: unknown,
    readonly format: string,
    readonly message?: string,
  ) {
    super('invalid_format', path, input)
  }

  toString() {
    return `Invalid ${this.formatDescription}${this.message ? ` (${this.message})` : ''}${stringifyPath(this.path)} (got ${stringifyValue(this.input)})`
  }

  toJSON() {
    return {
      ...super.toJSON(),
      format: this.format,
    }
  }

  /** Returns a human-readable description of the expected format. */
  get formatDescription(): string {
    switch (this.format) {
      case 'at-identifier':
        return `AT identifier`
      case 'did':
        return `DID`
      case 'nsid':
        return `NSID`
      case 'cid':
        return `CID string`
      case 'tid':
        return `TID string`
      case 'record-key':
        return `record key`
      default:
        return this.format
    }
  }
}

/**
 * Issue for values that have an unexpected type.
 *
 * This is one of the most common validation issues, occurring when the
 * runtime type of a value doesn't match the expected schema type.
 */
export class IssueInvalidType extends Issue {
  constructor(
    path: readonly PropertyKey[],
    input: unknown,
    readonly expected: readonly string[],
  ) {
    super('invalid_type', path, input)
  }

  toString() {
    return `Expected ${oneOf(this.expected.map(stringifyExpectedType))} value type${stringifyPath(this.path)} (got ${stringifyType(this.input)})`
  }

  toJSON() {
    return {
      ...super.toJSON(),
      expected: this.expected,
    }
  }
}

/**
 * Issue for values that don't match any of the expected literal values.
 *
 * Used when a value must be one of a specific set of allowed values
 * (e.g., enum-like constraints).
 */
export class IssueInvalidValue extends Issue {
  constructor(
    path: readonly PropertyKey[],
    input: unknown,
    readonly values: readonly unknown[],
  ) {
    super('invalid_value', path, input)
  }

  toString() {
    return `Expected ${oneOf(this.values.map(stringifyValue))}${stringifyPath(this.path)} (got ${stringifyValue(this.input)})`
  }

  toJSON() {
    return {
      ...super.toJSON(),
      values: this.values,
    }
  }
}

/**
 * Issue for missing required object properties.
 */
export class IssueRequiredKey extends Issue {
  constructor(
    path: readonly PropertyKey[],
    input: unknown,
    readonly key: PropertyKey,
  ) {
    super('required_key', path, input)
  }

  toString() {
    return `Missing required key "${String(this.key)}"${stringifyPath(this.path)}`
  }

  toJSON() {
    return {
      ...super.toJSON(),
      key: this.key,
    }
  }
}

/**
 * The type of measurement for size constraint issues.
 *
 * - `'array'` - Array length
 * - `'string'` - String length in characters
 * - `'integer'` - Numeric value
 * - `'grapheme'` - String length in grapheme clusters
 * - `'bytes'` - Byte length
 * - `'blob'` - Blob size
 */
export type MeasurableType =
  | 'array'
  | 'string'
  | 'integer'
  | 'grapheme'
  | 'bytes'
  | 'blob'

/**
 * Issue for values that exceed a maximum constraint.
 */
export class IssueTooBig extends Issue {
  constructor(
    path: readonly PropertyKey[],
    input: unknown,
    readonly maximum: number,
    readonly type: MeasurableType,
    readonly actual: number,
  ) {
    super('too_big', path, input)
  }

  toString() {
    return `${this.type} too big (maximum ${this.maximum})${stringifyPath(this.path)} (got ${this.actual})`
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      maximum: this.maximum,
    }
  }
}

/**
 * Issue for values that are below a minimum constraint.
 */
export class IssueTooSmall extends Issue {
  constructor(
    path: readonly PropertyKey[],
    input: unknown,
    readonly minimum: number,
    readonly type: MeasurableType,
    readonly actual: number,
  ) {
    super('too_small', path, input)
  }

  toString() {
    return `${this.type} too small (minimum ${this.minimum})${stringifyPath(this.path)} (got ${this.actual})`
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      minimum: this.minimum,
    }
  }
}

// -----------------------------------------------------------------------------
// Helper functions for formatting error messages
// -----------------------------------------------------------------------------

function stringifyExpectedType(expected: string): string {
  if (expected === '$typed') {
    return 'an object which includes the "$type" property'
  }
  return expected
}

function stringifyPath(path: readonly PropertyKey[]) {
  return ` at ${buildJsonPath(path)}`
}

function buildJsonPath(path: readonly PropertyKey[]): string {
  return `$${path.map(toJsonPathSegment).join('')}`
}

function toJsonPathSegment(segment: PropertyKey): string {
  if (typeof segment === 'number') {
    return `[${segment}]`
  } else if (/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(segment as string)) {
    return `.${segment}`
  } else {
    return `[${JSON.stringify(segment)}]`
  }
}

function oneOf(arr: readonly string[]): string {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  return `one of ${arr.slice(0, -1).join(', ')} or ${arr.at(-1)}`
}

function stringifyType(value: unknown): string {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      if (Array.isArray(value)) return 'array'
      if (ifCid(value)) return 'cid'
      if (isLegacyBlobRef(value)) return 'legacy-blob'
      if (value instanceof Date) return 'date'
      if (value instanceof RegExp) return 'regexp'
      if (value instanceof Map) return 'map'
      if (value instanceof Set) return 'set'
      return 'object'
    case 'number':
      if (Number.isInteger(value) && Number.isSafeInteger(value)) {
        return 'integer'
      }
      if (Number.isNaN(value)) {
        return 'NaN'
      }
      if (value === Infinity) {
        return 'Infinity'
      }
      if (value === -Infinity) {
        return '-Infinity'
      }
      return 'float'
    default:
      return typeof value
  }
}

function stringifyValue(value: unknown): string {
  switch (typeof value) {
    case 'bigint':
      return `${value}n`
    case 'number':
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'object':
      if (Array.isArray(value)) {
        return `[${stringifyArray(value, stringifyValue)}]`
      }
      if (isPlainObject(value)) {
        return `{${stringifyArray(Object.entries(value), stringifyObjectEntry)}}`
      }
    // fallthrough
    default:
      return stringifyType(value)
  }
}

/*@__NO_SIDE_EFFECTS__*/
function stringifyObjectEntry([key, _value]: [PropertyKey, unknown]): string {
  return `${JSON.stringify(key)}: ...`
}

/*@__NO_SIDE_EFFECTS__*/
function stringifyArray<T>(
  arr: readonly T[],
  fn: (item: T) => string,
  n = 2,
): string {
  return arr.slice(0, n).map(fn).join(', ') + (arr.length > n ? ', ...' : '')
}
