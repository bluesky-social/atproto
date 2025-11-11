import { isPlainObject } from '@atproto/lex-data'
import { ValidationContext, ValidationResult, Validator } from '../validation'

export type UnknownObjectOutput = { [_ in string]?: unknown }

export class UnknownObjectSchema extends Validator<UnknownObjectOutput> {
  readonly lexiconType = 'unknown' as const

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<UnknownObjectOutput> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    return ctx.success(input)
  }
}
