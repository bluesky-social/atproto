import { PropertyKey } from '../validation/property-key.js'
import {
  ContextualizedIssue,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation/validator.js'

export type CustomSchemaContext = {
  path: PropertyKey[]
  addIssue(issue: ContextualizedIssue): void
}

export type CustomAssertion<T = any> = (
  this: null,
  input: unknown,
  ctx: CustomSchemaContext,
) => input is T

export class CustomSchema<T = unknown> extends Validator<T> {
  constructor(
    private readonly assertion: CustomAssertion<T>,
    private readonly message: string,
    private readonly path?: PropertyKey | PropertyKey[],
  ) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<T> {
    if (this.assertion.call(null, input, ctx)) return ctx.success(input as T)
    return ctx.custom(input, this.message, this.path)
  }
}
