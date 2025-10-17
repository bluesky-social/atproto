import { CID } from 'multiformats/cid'
import { PropertyKey, isArray, isPureObject } from './util.js'

export interface IssueBase<I = unknown> {
  readonly input: I
  readonly code: string
  readonly message?: string
  readonly path: readonly PropertyKey[]
}

export interface IssueInvalidFormat extends IssueBase {
  readonly code: 'invalid_format'
  readonly format: string
}

export interface IssueInvalidType extends IssueBase {
  readonly code: 'invalid_type'
  readonly expected: string
}

export interface IssueInvalidValue extends IssueBase {
  readonly code: 'invalid_value'
  readonly values: readonly unknown[]
}

export interface IssueRequiredKey extends IssueBase {
  readonly code: 'required_key'
  readonly key: PropertyKey
}

export interface IssueTooBig extends IssueBase {
  readonly code: 'too_big'
  readonly maximum: number
  readonly type: 'array' | 'string' | 'integer' | 'grapheme' | 'bytes' | 'blob'
  readonly actual: number
}

export interface IssueTooSmall extends IssueBase {
  readonly code: 'too_small'
  readonly minimum: number
  readonly type: 'array' | 'string' | 'integer' | 'grapheme' | 'bytes'
  readonly actual: number
}

export type Issue =
  | IssueInvalidFormat
  | IssueInvalidType
  | IssueInvalidValue
  | IssueRequiredKey
  | IssueTooBig
  | IssueTooSmall

export function stringifyIssue(issue: Issue): string {
  const pathStr = issue.path.length ? ` at ${buildJsonPath(issue.path)}` : ''

  switch (issue.code) {
    case 'invalid_format':
      return `Invalid ${stringifyStringFormat(issue.format)} format${issue.message ? ` (${issue.message})` : ''} ${stringifyInputValue(issue.input)}${pathStr}`
    case 'invalid_type':
      return `Invalid value type ${stringifyInputType(issue.input)} (expected ${issue.expected})${pathStr}`
    case 'invalid_value':
      return `Invalid value ${stringifyInputValue(issue.input)} (expected ${oneOf(issue.values)})${pathStr}`
    case 'required_key':
      return `Missing required key "${String(issue.key)}"${pathStr}`
    case 'too_big':
      return `${issue.type} too big (got ${issue.actual}, maximum ${issue.maximum})${pathStr}`
    case 'too_small':
      return `${issue.type} too small (got ${issue.actual}, minimum ${issue.minimum})${pathStr}`
    default:
      // @ts-expect-error fool-proofing
      return `${issue.code} validation error${pathStr}`
  }
}

function buildJsonPath(path: readonly PropertyKey[]): string {
  let jsonPath = '$'
  for (const segment of path) {
    if (typeof segment === 'number') {
      jsonPath += `[${segment}]`
    } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment as string)) {
      jsonPath += `.${segment}`
    } else {
      jsonPath += `[${JSON.stringify(segment)}]`
    }
  }
  return jsonPath
}

function oneOf(arr: readonly unknown[]): string {
  if (arr.length === 0) return ''
  if (arr.length === 1) return stringifyInputValue(arr[0])
  return `one of ${arr.slice(0, -1).map(stringifyInputValue).join(', ')} or ${stringifyInputValue(arr.at(-1))}`
}

function stringifyStringFormat(format: string): string {
  switch (format) {
    case 'datetime':
      return 'RFC-3339 and ISO-8601'
    case 'language':
      return 'BCP 47 language tag'
    case 'at-identifier':
      return `DID or handle`
    case 'did':
      return `DID`
    case 'handle':
      return `handle`
    case 'nsid':
      return `NSID`
    case 'cid':
      return `CID string`
    case 'tid':
      return `TID string`
    case 'record-key':
      return `record key`
    default:
      return format
  }
}

function stringifyInputType(value: unknown): string {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      if (isArray(value)) return 'array'
      if (CID.asCID(value)) return 'cid'
      if (value instanceof Date) return 'date'
      if (value instanceof RegExp) return 'regexp'
      if (value instanceof Map) return 'map'
      if (value instanceof Set) return 'set'
      return 'object'
    default:
      return typeof value
  }
}

function stringifyInputValue(value: unknown): string {
  switch (typeof value) {
    case 'bigint':
      return `${value}n`
    case 'number':
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'object':
      if (isArray(value)) {
        return `[${stringifyArray(value, stringifyInputValue)}]`
      }
      if (isPureObject(value)) {
        return `{${stringifyArray(Object.entries(value), stringifyObjectEntry)}}`
      }
    // fallthrough
    default:
      return stringifyInputType(value)
  }
}

function stringifyObjectEntry([key, _value]: [PropertyKey, unknown]): string {
  return `${JSON.stringify(key)}: ...`
}

function stringifyArray<T>(
  arr: readonly T[],
  fn: (item: T) => string,
  n = 2,
): string {
  return arr.slice(0, n).map(fn).join(', ') + (arr.length > n ? ', ...' : '')
}
