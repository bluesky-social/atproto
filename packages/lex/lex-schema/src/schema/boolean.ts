import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export type BooleanSchemaOptions = {
  default?: boolean
}

export class BooleanSchema extends Schema<boolean> {
  constructor(readonly options?: BooleanSchemaOptions) {
    super()
  }

  validateInContext(
    input: unknown = this.options?.default,
    ctx: ValidatorContext,
  ): ValidationResult<boolean> {
    if (typeof input === 'boolean') {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'boolean')
  }
}
