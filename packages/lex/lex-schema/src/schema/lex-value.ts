import { LexValue, isLexScalar, isPlainObject } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export type { LexValue }

const EXPECTED_TYPES = Object.freeze([
  // Scalar types
  'null',
  'boolean',
  'integer',
  'string',
  'cid',
  'bytes',
  // Recursive types
  'array',
  'object',
] as const)

/**
 * AT Protocol lexicon values are any valid AT Protocol data types: string,
 * integer, boolean, null, bytes, cid, array, or object.
 */
export class LexValueSchema extends Schema<LexValue> {
  readonly type = 'lexValue' as const

  validateInContext(input: unknown, ctx: ValidationContext) {
    // @NOTE We are *not* using "isLexValue" here to allow for more specific
    // error messages about the path and type of the invalid value. The
    // "isLexValue" check is effectively performed by the recursive validation
    // of child properties below.

    // @NOTE There are two limitations to the fact that we are not using
    // "isLexValue" here:
    // 1. We cannot detect circular references in objects or arrays, which would
    //    cause infinite recursion. However, circular references are not valid
    //    AT Protocol data types, so this is not a concern for valid input. This
    //    could easily be addressed in the "validateChild" method by keeping
    //    track of "parent" objects.
    // 2. We are limited in the recursion depth we can validate due to potential
    //    recursion depth limits in JavaScript. However, this is also not a
    //    concern for most valid input, as extremely deep nesting is unlikely in
    //    typical use cases.
    if (isPlainObject(input)) {
      for (const key of Object.keys(input)) {
        const r = ctx.validateChild(input, key, this) // recursively validate all properties
        if (!r.success) return r
      }
    } else if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        const r = ctx.validateChild(input, i, this) // recursively validate all array items
        if (!r.success) return r
      }
    } else if (!isLexScalar(input)) {
      return ctx.issueInvalidType(input, EXPECTED_TYPES)
    }

    return ctx.success(input)
  }
}

/**
 * Creates a schema that accepts any valid AT Protocol data type: string,
 * integer, boolean, null, bytes, cid, array, or plain object. Arrays and
 * objects are recursively validated to ensure all nested values are also valid
 * AT Protocol data types.
 *
 * @see {@link LexValue} from `@atproto/lex-data` for the type definition of valid AT Protocol data types
 * @returns A new {@link LexValueSchema} instance
 *
 * @example
 * ```ts
 * const schema = l.lexValue()
 *
 * schema.validate('hello')              // success
 * schema.validate(42)                   // success
 * schema.validate(null)                 // success
 * schema.validate([1, 'two', null])     // success
 * schema.validate({ any: 'props' })     // success
 * schema.validate(new Date())           // fails - Date is not a valid LexValue
 * schema.validate({ foo: 1.2 })         // fails - 1.2 is not a valid LexValue (not an integer)
 * ```
 */
export const lexValue = /*#__PURE__*/ memoizedOptions(function () {
  return new LexValueSchema()
})
