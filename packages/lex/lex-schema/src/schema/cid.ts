import {
  CID,
  DAG_CBOR_MULTICODEC,
  RAW_BIN_MULTICODEC,
  SHA2_256_MULTIHASH_CODE,
  asLexLink,
} from '@atproto/lex-data'
import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export type CidSchemaOptions = {
  strict?: boolean
}

export class CidSchema extends Validator<CID> {
  readonly lexiconType = 'cid-link' as const

  constructor(readonly options: CidSchemaOptions = {}) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<CID> {
    const cid = asLexLink(input)
    if (!cid) return ctx.issueInvalidType(input, 'cid')

    if (this.options.strict) {
      if (cid.version !== 1) {
        return ctx.issueInvalidType(input, 'cid')
      }
      if (cid.code !== RAW_BIN_MULTICODEC && cid.code !== DAG_CBOR_MULTICODEC) {
        return ctx.issueInvalidType(input, 'cid')
      }
      if (cid.multihash.code !== SHA2_256_MULTIHASH_CODE) {
        return ctx.issueInvalidType(input, 'cid')
      }
    }

    return ctx.success(cid)
  }
}
