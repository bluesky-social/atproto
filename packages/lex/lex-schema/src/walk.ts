import { isObject, isPlainObject, isPlainProto } from '@atproto/lex-data'
import { Schema } from './core.js'
import { Procedure, Query, Subscription } from './schema.js'

export function* walk(
  ns: unknown,
): Generator<Schema | Procedure | Subscription | Query, void, unknown> {
  if (isPlainObject(ns)) {
    return yield* walkInternal(ns, new Set<unknown>())
  }
}

function* walkInternal(
  ns: Record<string, unknown>,
  visited: Set<unknown>,
): Generator<Schema | Procedure | Subscription | Query, void, unknown> {
  for (const [key, value] of Object.entries(ns)) {
    // Ignore helpers
    if (key.startsWith('$')) {
      continue
    }

    // Ignore non-objects
    if (!isObject(value)) {
      continue
    }

    // Ignore "main" re-exported as "default"
    if (key === 'default' && value === ns['main']) {
      continue
    }

    // De-dupe
    if (visited.has(value)) {
      continue
    }

    visited.add(value)

    if (
      value instanceof Schema ||
      value instanceof Procedure ||
      value instanceof Subscription ||
      value instanceof Query
    ) {
      yield value
    } else if (isPlainProto(value)) {
      // child namespace
      yield* walkInternal(value, visited)
    }
  }
}
