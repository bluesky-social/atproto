import { isPlainObject } from '@atproto/lex-data'
import { WithOptionalProperties } from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import {
  Infer,
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'

export type ObjectSchemaProperties = Record<string, Validator>

export type ObjectSchemaOutput<Properties extends ObjectSchemaProperties> =
  WithOptionalProperties<{
    [K in keyof Properties]: Infer<Properties[K]>
  }>

export class ObjectSchema<const Properties extends ObjectSchemaProperties = any>
  extends Schema<ObjectSchemaOutput<Properties>>
  implements Validator<ObjectSchemaOutput<Properties>>
{
  constructor(readonly validators: Properties) {
    super()
  }

  get validatorsMap(): Map<string, Validator> {
    const map = new Map(Object.entries(this.validators))

    return lazyProperty(this, 'validatorsMap', map)
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<ObjectSchemaOutput<Properties>> {
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

    const output = (copy ?? input) as ObjectSchemaOutput<Properties>

    return ctx.success(output)
  }
}
