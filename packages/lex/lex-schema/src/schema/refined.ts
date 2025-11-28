import {
  IssueCustom,
  PropertyKey,
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'

export type Refinement<T> = {
  check: (value: T) => boolean
  message: string
  path?: PropertyKey | readonly PropertyKey[]
}

export class RefinedSchema<T> extends Schema<T> {
  constructor(
    readonly schema: Validator<T>,
    readonly refinements: [Refinement<T>, ...Refinement<T>[]],
  ) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<T> {
    const result = ctx.validate(input, this.schema)
    if (!result.success) return result

    for (const refinement of this.refinements) {
      if (!refinement.check(result.value)) {
        const path = ctx.concatPath(refinement.path)
        return ctx.failure(new IssueCustom(path, input, refinement.message))
      }
    }

    return result
  }
}
