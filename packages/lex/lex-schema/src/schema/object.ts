import { isPlainObject } from '@atproto/lex-data'
import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
  WithOptionalProperties,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'

/**
 * Type representing the shape of an object schema.
 *
 * Maps property names to their corresponding validators.
 */
export type ObjectSchemaShape = Record<string, Validator>

/**
 * Schema for validating objects with a defined shape.
 *
 * Each property in the shape is validated against its corresponding schema.
 * Properties wrapped in `optional()` are not required.
 *
 * @template TShape - The object shape type mapping property names to validators
 *
 * @example
 * ```ts
 * const schema = new ObjectSchema({
 *   name: l.string(),
 *   age: l.optional(l.integer()),
 * })
 * const result = schema.validate({ name: 'Alice' })
 * ```
 */
export class ObjectSchema<
  const TShape extends ObjectSchemaShape = any,
> extends Schema<
  WithOptionalProperties<{
    [K in keyof TShape]: InferInput<TShape[K]>
  }>,
  WithOptionalProperties<{
    [K in keyof TShape]: InferOutput<TShape[K]>
  }>
> {
  readonly type = 'object' as const

  constructor(readonly shape: TShape) {
    super()
  }

  get validatorsMap(): Map<string, Validator> {
    const map = new Map(Object.entries(this.shape))

    return lazyProperty(this, 'validatorsMap', map)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isPlainObject(input)) {
      return ctx.issueUnexpectedType(input, 'object')
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    for (const [key, propDef] of this.validatorsMap) {
      const result = ctx.validateChild(input, key, propDef)
      if (!result.success) {
        if (!(key in input)) {
          // Transform into "required key" issue
          return ctx.issueRequiredKey(input, key)
        }

        return result
      }

      // Skip copying if key is not present in input (and value is undefined)
      if (result.value === undefined && !(key in input)) {
        continue
      }

      if (!Object.is(result.value, input[key])) {
        if (ctx.options.mode === 'validate') {
          // In "validate" mode, we can't modify the input, so we issue an error
          return ctx.issueInvalidPropertyValue(input, key, [result.value])
        }

        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    return ctx.success(copy ?? input)
  }
}

/**
 * Creates an object schema with the specified property validators.
 *
 * Validates that the input is a plain object and each property matches
 * its corresponding schema. Properties wrapped in `optional()` are not required.
 *
 * @param properties - Object mapping property names to their validators
 * @returns A new {@link ObjectSchema} instance
 *
 * @example
 * ```ts
 * // Basic object
 * const userSchema = l.object({
 *   name: l.string(),
 *   email: l.string({ format: 'uri' }),
 * })
 *
 * // With optional properties
 * const profileSchema = l.object({
 *   displayName: l.string(),
 *   bio: l.optional(l.string({ maxLength: 256 })),
 *   avatar: l.optional(l.blob({ accept: ['image/*'] })),
 * })
 *
 * // Nested objects
 * const postSchema = l.object({
 *   text: l.string(),
 *   author: l.object({
 *     did: l.string({ format: 'did' }),
 *     handle: l.string({ format: 'handle' }),
 *   }),
 * })
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function object<const TShape extends ObjectSchemaShape>(
  properties: TShape,
) {
  return new ObjectSchema<TShape>(properties)
}
