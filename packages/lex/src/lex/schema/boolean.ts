import { ValidationContext, ValidationResult, Validator } from '../core.js'

export type BooleanSchemaOptions = {
  default?: boolean
}

export class BooleanSchema extends Validator<boolean> {
  constructor(readonly options: BooleanSchemaOptions) {
    super()
  }

  protected override validateInContext(
    input: unknown = this.options.default,
    ctx: ValidationContext,
  ): ValidationResult<boolean> {
    if (typeof input !== 'boolean') {
      return ctx.issueInvalidType(input, 'boolean')
    }

    return ctx.success(input as boolean)
  }
}
