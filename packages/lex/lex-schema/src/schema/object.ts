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

export type ObjectSchemaShape = Record<string, Validator>

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
  constructor(readonly shape: TShape) {
    super()
  }

  get validatorsMap(): Map<string, Validator> {
    const map = new Map(Object.entries(this.shape))

    return lazyProperty(this, 'validatorsMap', map)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
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

/*@__NO_SIDE_EFFECTS__*/
export function object<const TShape extends ObjectSchemaShape>(
  properties: TShape,
) {
  return new ObjectSchema<TShape>(properties)
}
