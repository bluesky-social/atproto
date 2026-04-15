import { CheckCidOptions, Cid, InferCheckedCid, isCid } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export type { Cid }

/**
 * Configuration options for CID schema validation.
 *
 * @see CheckCidOptions from @atproto/lex-data for available options
 */
export type CidSchemaOptions = CheckCidOptions

/**
 * Schema for validating Content Identifiers (CIDs).
 *
 * CIDs are self-describing content-addressed identifiers used in AT Protocol
 * to reference data by its cryptographic hash. This schema validates that
 * the input is a valid CID object.
 *
 * @template TOptions - The configuration options type
 *
 * @example
 * ```ts
 * const schema = new CidSchema()
 * const result = schema.validate(someCid)
 * ```
 */
export class CidSchema<
  const TOptions extends CidSchemaOptions = { flavor: undefined },
> extends Schema<InferCheckedCid<TOptions>> {
  readonly type = 'cid' as const

  constructor(readonly options?: TOptions) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isCid(input, this.options)) {
      return ctx.issueUnexpectedType(input, 'cid')
    }

    return ctx.success(input)
  }
}

/**
 * Creates a CID schema for validating Content Identifiers.
 *
 * CIDs are used throughout AT Protocol to reference content by its hash.
 * This is commonly used for referencing blobs, commits, and other data.
 *
 * @param options - Optional configuration for CID validation
 * @returns A new {@link CidSchema} instance
 *
 * @example
 * ```ts
 * // Basic CID validation
 * const cidSchema = l.cid()
 *
 * // Validate a CID from a blob reference
 * const result = cidSchema.validate(blobRef.ref)
 * ```
 */
export const cid = /*#__PURE__*/ memoizedOptions(function <
  O extends CidSchemaOptions = NonNullable<unknown>,
>(options?: O) {
  return new CidSchema(options)
})
