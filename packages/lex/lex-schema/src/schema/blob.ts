import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'
import {
  BlobRef,
  typedBlobRefSchema,
  untypedBlobRefSchema,
} from './_blob-ref.js'

export type BlobSchemaOptions = {
  accept?: string[] // List of accepted mime types
  maxSize?: number // Maximum size in bytes
}

export class BlobSchema extends Validator<BlobRef> {
  readonly lexiconType = 'blob' as const

  constructor(readonly options: BlobSchemaOptions) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<BlobRef> {
    const result =
      // @ts-expect-error this is actually fine (using hint to select schema)
      input?.$type === 'blob'
        ? ctx.validate(input, typedBlobRefSchema)
        : ctx.validate(input, untypedBlobRefSchema)

    if (!result.success) {
      return ctx.issueInvalidType(input, ['blob'])
    }

    // @NOTE Historically, we did not enforce constraints on blob references
    // https://github.com/bluesky-social/atproto/blob/4c15fb47cec26060bff2e710e95869a90c9d7fdd/packages/lexicon/src/validators/blob.ts#L5-L19

    // const { accept } = this.$options
    // if (accept && !accept.includes(blob.mimeType)) {
    //   return ctx.issueInvalidValue(input, accept)
    // }

    // const { maxSize } = this.$options
    // if (maxSize != null && blob.size != -1 && blob.size > maxSize) {
    //   return ctx.issueTooBig(input, 'blob', maxSize, blob.size)
    // }

    return result
  }
}
