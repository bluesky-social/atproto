import { ifCid, isPlainObject } from '@atproto/lex-data'
import { PropertyKey } from './property-key.js'

export abstract class Issue {
  constructor(
    readonly code: string,
    readonly path: readonly PropertyKey[],
    readonly input: unknown,
  ) {}

  abstract toString(): string

  toJSON() {
    return {
      code: this.code,
      path: this.path,
      message: this.toString(),
    }
  }
}

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

export type MeasurableType =
  | 'array'
  | 'string'
  | 'integer'
  | 'grapheme'
  | 'bytes'
  | 'blob'

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

function stringifyExpectedType(expected: string): string {
  if (expected === '$typed') {
    return 'an object or record which includes a "$type" property'
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
