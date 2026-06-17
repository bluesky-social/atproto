import { LexMap, isPlainObject } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'
import { lexValue } from './lex-value.js'

const propertyValueSchema = /*#__PURE__*/ lexValue()

export type { LexMap }

/**
 * AT Protocol lexicon schema definitions with "type": "unknown" are represented
 * as plain objects with string keys and values that are valid AT Protocol data
 * types (string, integer, boolean, null, bytes, cid, array, or object). This
 * type alias corresponds to the expected structure of such "unknown" schema
 * values.
 */
export class LexMapSchema extends Schema<LexMap> {
  readonly type = 'lexMap' as const

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isPlainObject(input)) {
      return ctx.issueUnexpectedType(input, 'object')
    }

    for (const key of Object.keys(input)) {
      // @NOTE We use a lexValue() schema here to recursively validate all
      // nested values, which ensures that the error reporting includes the
      // correct path and type information for any invalid nested values. This
      // allows for more informative error descriptions than a simple "isLexMap"
      // check.
      const r = ctx.validateChild(input, key, propertyValueSchema) // recursively validate all properties
      if (!r.success) return r
    }

    return ctx.success(input)
  }
}

/**
 * Creates a schema that accepts any plain object with string keys and values
 * that are valid AT Protocol data types (string, integer, boolean, null, bytes,
 * cid, array, or object).
 *
 * @see {@link LexMap} from `@atproto/lex-data` for the type definition of valid AT Protocol data types
 * @returns A new {@link LexMapSchema} instance
 *
 * @example
 * ```ts
 * // Accept any object shape
 * const schema = l.lexMap()
 *
 * schema.validate({ any: 'props' })    // success
 * schema.validate([1, 2, 3])           // fails - only plain objects are accepted
 * schema.validate({ foo: new Date() }) // fails - Date is not a valid LexValue
 * schema.validate({ foo: 1.2 })        // fails - 1.2 is not a valid LexValue (not an integer)
 * ```
 */
export const lexMap = /*#__PURE__*/ memoizedOptions(function () {
  return new LexMapSchema()
})

/** @deprecated Use {@link lexMap} instead */
export const unknownObject = lexMap
