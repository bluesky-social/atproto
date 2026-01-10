import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export type LiteralSchemaOptions<T extends null | string | number | boolean> = {
  default?: T
}

export class LiteralSchema<
  Output extends null | string | number | boolean = any,
> extends Schema<Output> {
  constructor(
    readonly value: Output,
    readonly options?: LiteralSchemaOptions<Output>,
  ) {
    super()
  }

  validateInContext(
    input: unknown = this.options?.default,
    ctx: ValidatorContext,
  ): ValidationResult<Output> {
    if (input !== this.value) {
      return ctx.issueInvalidValue(input, [this.value])
    }

    return ctx.success(this.value)
  }
}
