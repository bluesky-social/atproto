import {
  RAW_BIN_MULTICODEC,
  SHA2_256_MULTIHASH_CODE,
  asLexBlob,
} from '@atproto/lex-data'
import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'
import { BlobRef, TypedBlobRef, legacyBlobRefSchema } from './_blob-ref.js'

export type BlobSchemaOptions = {
  /**
   * Whether to allow legacy blob references format
   * @see {@link BlobRef}
   */
  allowLegacy?: boolean
  /**
   * Whether to enforce strict validation on the blob reference (CID version, codec, hash function)
   */
  strict?: boolean
  /**
   * List of accepted mime types
   */
  accept?: string[]
  /**
   * Maximum size in bytes
   */
  maxSize?: number
}

export type BlobSchemaOutput<Options> = Options extends { allowLegacy: true }
  ? BlobRef
  : TypedBlobRef

export class BlobSchema<O extends BlobSchemaOptions> extends Validator<
  BlobSchemaOutput<O>
> {
  readonly lexiconType = 'blob' as const

  constructor(readonly options: O) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<BlobSchemaOutput<O>> {
    if (this.options.allowLegacy && (input as any)?.$type === undefined) {
      const result = ctx.validate(input, legacyBlobRefSchema)
      if (result.success) return result as ValidationResult<BlobSchemaOutput<O>>
      return ctx.issueInvalidType(input, 'blob')
    }

    // Optimization: We use "asLexBlob" instead of typedBlobRefSchema as it
    // faster.
    const blob = asLexBlob(input)
    if (!blob) return ctx.issueInvalidType(input, 'blob')

    if (this.options.strict) {
      const cid = blob.ref
      if (cid.version !== 1) {
        return ctx.issueInvalidType(input, 'blob')
      }
      if (cid.code !== RAW_BIN_MULTICODEC) {
        return ctx.issueInvalidType(input, 'blob')
      }
      if (cid.multihash.code !== SHA2_256_MULTIHASH_CODE) {
        return ctx.issueInvalidType(input, 'blob')
      }
    }

    // @NOTE Historically, we did not enforce constraints on blob references
    // https://github.com/bluesky-social/atproto/blob/4c15fb47cec26060bff2e710e95869a90c9d7fdd/packages/lexicon/src/validators/blob.ts#L5-L19

    // const { accept } = this.options
    // if (accept && !accept.includes(blob.mimeType)) {
    //   return ctx.issueInvalidValue(input, accept)
    // }

    // const { maxSize } = this.options
    // if (maxSize != null && blob.size != -1 && blob.size > maxSize) {
    //   return ctx.issueTooBig(input, 'blob', maxSize, blob.size)
    // }

    return ctx.success(blob)
  }
}
