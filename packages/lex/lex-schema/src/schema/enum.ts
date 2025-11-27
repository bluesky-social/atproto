import { ValidationResult, Validator, ValidatorContext } from '../validation.js'

export type EnumSchemaOptions<T extends null | string | number | boolean> = {
  default?: T
}

export class EnumSchema<
  Output extends null | string | number | boolean = any,
> extends Validator<Output> {
  constructor(
    readonly values: readonly Output[],
    readonly options?: EnumSchemaOptions<Output>,
  ) {
    super()
  }

  override validateInContext(
    input: unknown = this.options?.default,
    ctx: ValidatorContext,
  ): ValidationResult<Output> {
    if (!(this.values as readonly unknown[]).includes(input)) {
      return ctx.issueInvalidValue(input, this.values)
    }

    return ctx.success(input as Output)
  }
}
