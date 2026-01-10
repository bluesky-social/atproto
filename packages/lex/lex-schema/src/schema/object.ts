import { isPlainObject } from '@atproto/lex-data'
import {
  Infer,
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
  WithOptionalProperties,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'

export type ObjectSchemaShape = Record<string, Validator>

export type ObjectSchemaOutput<Shape extends ObjectSchemaShape> =
  WithOptionalProperties<{
    [K in keyof Shape]: Infer<Shape[K]>
  }>

export class ObjectSchema<
  const Shape extends ObjectSchemaShape = any,
> extends Schema<ObjectSchemaOutput<Shape>> {
  constructor(readonly shape: Shape) {
    super()
  }

  get validatorsMap(): Map<string, Validator> {
    const map = new Map(Object.entries(this.shape))

    return lazyProperty(this, 'validatorsMap', map)
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<ObjectSchemaOutput<Shape>> {
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

      if (result.value !== input[key]) {
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    const output = (copy ?? input) as ObjectSchemaOutput<Shape>

    return ctx.success(output)
  }
}
