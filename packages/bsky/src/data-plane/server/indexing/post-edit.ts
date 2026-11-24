import type { LexValue } from '@atproto/lex-data'
import { lexStringify } from '@atproto/lex-json'

export const POST_EDIT_LIMIT = 1
export const POST_EDIT_WINDOW_MS = 5 * 60_000 + 30_000

type JsonObject = Record<string, unknown>

export class InvalidPostEditError extends Error {
  name = 'InvalidPostEditError'
}

export class PostEditLimitError extends Error {
  name = 'PostEditLimitError'
}

export class PostEditWindowError extends Error {
  name = 'PostEditWindowError'
}

export function validatePostEdit(previous: unknown, next: unknown): void {
  const previousRecord = asJsonObject(previous)
  const nextRecord = asJsonObject(next)
  const previousTree = postEditTree(previousRecord)
  const nextTree = postEditTree(nextRecord)

  const changedPath = firstDifference(previousTree, nextTree)
  if (changedPath) {
    throw new InvalidPostEditError(
      `Post edit changes ${changedPath}, which is not editable`,
    )
  }

  const nextLabels = selfLabelValues(nextRecord)
  for (const label of selfLabelValues(previousRecord)) {
    if (!nextLabels.has(label)) {
      throw new InvalidPostEditError(
        'Post edit removes labels.values, which is not editable',
      )
    }
  }
}

function asJsonObject(value: unknown): JsonObject {
  const parsed = JSON.parse(lexStringify(value as LexValue))
  if (!isJsonObject(parsed)) {
    throw new InvalidPostEditError('Post record is not an object')
  }
  return parsed
}

function postEditTree(record: JsonObject): unknown {
  const tree = structuredClone(record)
  delete tree.$type
  delete tree.text
  delete tree.langs
  delete tree.labels

  if (Array.isArray(tree.facets)) {
    for (const facet of tree.facets) {
      if (isJsonObject(facet)) delete facet.index
    }
  }
  deleteKeyDeep(tree, 'alt')
  return pruneEmpty(tree)
}

function selfLabelValues(record: JsonObject): Set<string> {
  const labels = record.labels
  if (!isJsonObject(labels) || !Array.isArray(labels.values)) return new Set()
  return new Set(
    labels.values.flatMap((label) => {
      if (!isJsonObject(label) || typeof label.val !== 'string') return []
      return [label.val]
    }),
  )
}

function deleteKeyDeep(value: unknown, key: string): void {
  if (Array.isArray(value)) {
    for (const child of value) deleteKeyDeep(child, key)
  } else if (isJsonObject(value)) {
    delete value[key]
    for (const child of Object.values(value)) deleteKeyDeep(child, key)
  }
}

function pruneEmpty(value: unknown): unknown {
  if (Array.isArray(value)) {
    const values = value.map(pruneEmpty)
    return values.length ? values : undefined
  }
  if (isJsonObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const pruned = pruneEmpty(child)
      if (pruned === undefined) {
        delete value[key]
      } else {
        value[key] = pruned
      }
    }
    return Object.keys(value).length ? value : undefined
  }
  return value
}

function firstDifference(
  previous: unknown,
  next: unknown,
  path: string[] = [],
): string | undefined {
  if (previous === undefined || next === undefined) {
    return previous === next ? undefined : formatPath(path)
  }

  if (Array.isArray(previous)) {
    if (!Array.isArray(next) || previous.length !== next.length) {
      return formatPath(path)
    }
    for (let i = 0; i < previous.length; i++) {
      const difference = firstDifference(previous[i], next[i], [
        ...path,
        `[${i}]`,
      ])
      if (difference) return difference
    }
    return undefined
  }

  if (isJsonObject(previous)) {
    if (!isJsonObject(next)) return formatPath(path)
    for (const key of Object.keys(previous).sort()) {
      const difference = firstDifference(previous[key], next[key], [
        ...path,
        key,
      ])
      if (difference) return difference
    }
    for (const key of Object.keys(next).sort()) {
      if (!(key in previous)) return formatPath([...path, key])
    }
    return undefined
  }

  return Object.is(previous, next) ? undefined : formatPath(path)
}

function formatPath(path: string[]): string {
  if (!path.length) return 'record'
  return path.reduce(
    (result, segment) =>
      result && !segment.startsWith('[')
        ? `${result}.${segment}`
        : `${result}${segment}`,
    '',
  )
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
