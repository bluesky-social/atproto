import { ValidationResult, Validator, ValidatorContext } from '../validation.js'

export type BooleanSchemaOptions = {
  default?: boolean
}

export class BooleanSchema extends Validator<boolean> {
  readonly lexiconType = 'boolean' as const

  constructor(readonly options?: BooleanSchemaOptions) {
    super()
  }

  override validateInContext(
    input: unknown = this.options?.default,
    ctx: ValidatorContext,
  ): ValidationResult<boolean> {
    if (typeof input === 'boolean') {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'boolean')
  }
}
