import {
  Issue,
  IssueCustom,
  PropertyKey,
  Schema,
  ValidationContext,
} from '../core.js'

export type CustomAssertionContext = {
  path: PropertyKey[]
  addIssue(issue: Issue): void
}

export type CustomAssertion<TValue> = (
  this: null,
  input: unknown,
  ctx: CustomAssertionContext,
) => input is TValue

export class CustomSchema<const TValue = unknown> extends Schema<TValue> {
  constructor(
    private readonly assertion: CustomAssertion<TValue>,
    private readonly message: string,
    private readonly path?: PropertyKey | readonly PropertyKey[],
  ) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!this.assertion.call(null, input, ctx)) {
      const path = ctx.concatPath(this.path)
      return ctx.issue(new IssueCustom(path, input, this.message))
    }
    return ctx.success(input as TValue)
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function custom<TValue>(
  assertion: CustomAssertion<TValue>,
  message: string,
  path?: PropertyKey | readonly PropertyKey[],
) {
  return new CustomSchema<TValue>(assertion, message, path)
}
