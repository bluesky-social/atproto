import { LexMap, isLexMap } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

/**
 * Type alias for a plain object with unknown values.
 */
export type UnknownObject = LexMap

/**
 * Schema that accepts any plain object without validating its properties.
 *
 * Validates that the input is a plain object (not an array, Date, or other
 * special object type), but does not validate the object's properties.
 *
 * @example
 * ```ts
 * const schema = new UnknownObjectSchema()
 * schema.validate({ any: 'props' }) // success
 * schema.validate([1, 2, 3])        // fails - arrays not accepted
 * ```
 */
export class UnknownObjectSchema extends Schema<UnknownObject> {
  readonly type = 'unknownObject' as const

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (isLexMap(input)) {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'unknown')
  }
}

/**
 * Creates a schema that accepts any plain object.
 *
 * Unlike `l.unknown()` which accepts any value, this validates that the input
 * is specifically a plain object (not an array, null, or primitive).
 *
 * @returns A new {@link UnknownObjectSchema} instance
 *
 * @example
 * ```ts
 * // Accept any object shape
 * const metadataSchema = l.unknownObject()
 *
 * metadataSchema.parse({ foo: 1, bar: 'baz' }) // success
 * metadataSchema.parse([1, 2, 3])              // throws - not a plain object
 * metadataSchema.parse(null)                   // throws
 * ```
 */
export const unknownObject = /*#__PURE__*/ memoizedOptions(function () {
  return new UnknownObjectSchema()
})
