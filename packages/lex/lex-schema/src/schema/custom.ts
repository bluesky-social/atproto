import { PropertyKey } from '../validation/property-key.js'
import {
  ContextualIssue,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation/validator.js'

export type CustomAssertionContext = {
  path: PropertyKey[]
  addIssue(issue: ContextualIssue): void
}

export type CustomAssertion<T = any> = (
  this: null,
  input: unknown,
  ctx: CustomAssertionContext,
) => input is T

export class CustomSchema<T = unknown> extends Validator<T> {
  constructor(
    private readonly assertion: CustomAssertion<T>,
    private readonly message: string,
    private readonly path?: PropertyKey | readonly PropertyKey[],
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
