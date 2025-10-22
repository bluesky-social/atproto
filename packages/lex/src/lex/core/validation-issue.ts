import { CID } from 'multiformats/cid'
import { isPureObject } from '../lib/is-object.js'
import { PropertyKey } from './property-key.js'

export interface ValidationIssue<I = unknown> {
  readonly input: I
  readonly code: string
  readonly message?: string
  readonly path: readonly PropertyKey[]
}

export interface IssueInvalidFormat extends ValidationIssue {
  readonly code: 'invalid_format'
  readonly format: string
}

export interface IssueInvalidType extends ValidationIssue {
  readonly code: 'invalid_type'
  readonly expected: readonly string[]
}

export interface IssueInvalidValue extends ValidationIssue {
  readonly code: 'invalid_value'
  readonly values: readonly unknown[]
}

export interface IssueRequiredKey extends ValidationIssue {
  readonly code: 'required_key'
  readonly key: PropertyKey
}

export interface IssueTooBig extends ValidationIssue {
  readonly code: 'too_big'
  readonly maximum: number
  readonly type: 'array' | 'string' | 'integer' | 'grapheme' | 'bytes' | 'blob'
  readonly actual: number
}

export interface IssueTooSmall extends ValidationIssue {
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
      return `Invalid ${stringifyStringFormat(issue.format)} format${issue.message ? ` (${issue.message})` : ''}${pathStr} (got ${stringifyValue(issue.input)})`
    case 'invalid_type':
      return `Expected ${oneOf(issue.expected.map(stringifyExpectedType))} value type${pathStr} (got ${stringifyType(issue.input)})`
    case 'invalid_value':
      return `Expected ${oneOf(issue.values.map(stringifyValue))}${pathStr} (got ${stringifyValue(issue.input)})`
    case 'required_key':
      return `Missing required key "${String(issue.key)}"${pathStr}`
    case 'too_big':
      return `${issue.type} too big (maximum ${issue.maximum})${pathStr} (got ${issue.actual})`
    case 'too_small':
      return `${issue.type} too small (minimum ${issue.minimum})${pathStr} (got ${issue.actual})`
    default:
      // @ts-expect-error fool-proofing
      return `${issue.code} validation error${pathStr}`
  }
}

function stringifyExpectedType(expected: string): string {
  if (expected === '$typed') {
    return 'an object or record which includes a "$type" property'
  }

  return expected
}

function buildJsonPath(path: readonly PropertyKey[]): string {
  let jsonPath = '$'
  for (const segment of path) {
    if (typeof segment === 'number') {
      jsonPath += `[${segment}]`
    } else if (/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(segment as string)) {
      jsonPath += `.${segment}`
    } else {
      jsonPath += `[${JSON.stringify(segment)}]`
    }
  }
  return jsonPath
}

function oneOf(arr: readonly string[]): string {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  return `one of ${arr.slice(0, -1).join(', ')} or ${arr.at(-1)}`
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

function stringifyType(value: unknown): string {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      if (Array.isArray(value)) return 'array'
      if (CID.asCID(value)) return 'cid'
      if (value instanceof Date) return 'date'
      if (value instanceof RegExp) return 'regexp'
      if (value instanceof Map) return 'map'
      if (value instanceof Set) return 'set'
      return 'object'
    case 'number':
      if (Number.isInteger(value)) return 'integer'
      if (Number.isNaN(value)) return 'NaN'
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
      if (isPureObject(value)) {
        return `{${stringifyArray(Object.entries(value), stringifyObjectEntry)}}`
      }
    // fallthrough
    default:
      return stringifyType(value)
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

export function aggregateIssues(issues: Issue[]): Issue[] {
  // Quick path for common cases
  if (issues.length <= 1) return issues
  if (issues.length === 2 && issues[0].code !== issues[1].code) return issues

  return [
    // Aggregate invalid_type on the same path
    ...arrayAgg(
      issues.filter((issue) => issue.code === 'invalid_type'),
      (a, b) => comparePropertyPaths(a.path, b.path),
      (issues) => ({
        ...issues[0],
        expected: Array.from(new Set(issues.flatMap((iss) => iss.expected))),
      }),
    ),
    // Aggregate invalid_value on the same path
    ...arrayAgg(
      issues.filter((issue) => issue.code === 'invalid_value'),
      (a, b) => comparePropertyPaths(a.path, b.path),
      (issues) => ({
        ...issues[0],
        values: Array.from(new Set(issues.flatMap((iss) => iss.values))),
      }),
    ),
    // Pass through other issues
    ...issues.filter(
      (issue) =>
        issue.code !== 'invalid_type' && issue.code !== 'invalid_value',
    ),
  ]
}

function arrayAgg<T>(
  arr: readonly T[],
  cmp: (a: T, b: T) => boolean,
  agg: (items: [T, ...T[]]) => T,
): T[] {
  if (arr.length === 0) return []

  const groups: [T, ...T[]][] = [[arr[0]]]
  const skipped = Array<undefined | boolean>(arr.length)

  outer: for (let i = 1; i < arr.length; i++) {
    if (skipped[i]) continue
    const item = arr[i]
    for (let j = 0; j < groups.length; j++) {
      if (cmp(item, groups[j][0])) {
        groups[j].push(item)
        skipped[i] = true
        continue outer
      }
    }
    groups.push([item])
  }

  return groups.map(agg)
}

function comparePropertyPaths(
  a: readonly PropertyKey[],
  b: readonly PropertyKey[],
) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
