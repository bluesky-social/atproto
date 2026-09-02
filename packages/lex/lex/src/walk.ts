import { isObject, isPlainObject, isPlainProto } from '@atproto/lex-data'
import { Procedure, Query, Schema, Subscription } from '@atproto/lex-schema'

export function* walk(
  ns: Record<string, unknown>,
): Generator<Schema | Procedure | Subscription | Query> {
  if (!isPlainObject(ns)) return

  const visited = new Set<unknown>()

  for (const [key, value] of Object.entries(ns)) {
    // Ignore helpers
    if (key.startsWith('$')) {
      continue
    }

    // Ignore non-objects (should never happen)
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
      yield* walk(value)
    }
  }
}
