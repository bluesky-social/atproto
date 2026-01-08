import { Cid, CidCheckOptions, InferCheckedCid, isCid } from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export type { Cid }

export type CidSchemaOptions = CidCheckOptions
export type CidSchemaOutput<TOptions extends CidSchemaOptions> =
  InferCheckedCid<TOptions>

export class CidSchema<TOptions extends CidSchemaOptions> extends Schema<
  CidSchemaOutput<TOptions>
> {
  constructor(readonly options: TOptions) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<CidSchemaOutput<TOptions>> {
    if (!isCid(input, this.options)) {
      return ctx.issueInvalidType(input, 'cid')
    }

    return ctx.success(input)
  }
}
