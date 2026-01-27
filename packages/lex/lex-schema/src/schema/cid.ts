import { CheckCidOptions, Cid, InferCheckedCid, isCid } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export type { Cid }

export type CidSchemaOptions = CheckCidOptions

export class CidSchema<
  const TOptions extends CidSchemaOptions = { flavor: undefined },
> extends Schema<InferCheckedCid<TOptions>> {
  constructor(readonly options?: TOptions) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isCid(input, this.options)) {
      return ctx.issueInvalidType(input, 'cid')
    }

    return ctx.success(input)
  }
}

export const cid = /*#__PURE__*/ memoizedOptions(function <
  O extends CidSchemaOptions = NonNullable<unknown>,
>(options?: O) {
  return new CidSchema(options)
})
