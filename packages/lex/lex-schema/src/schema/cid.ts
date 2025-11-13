import {
  CID,
  DAG_CBOR_MULTICODEC,
  RAW_BIN_MULTICODEC,
  SHA2_256_MULTIHASH_CODE,
  isCid,
  isPlainObject,
  parseLexLink,
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
    const cid = coerceToCid(input)
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

/**
 * Coerces {@link Json} or {@link LexValue} into a {@link CID}.
 */
export function coerceToCid(input: unknown): CID | undefined {
  if (isCid(input)) {
    return input
  }

  if (isPlainObject(input)) {
    try {
      return parseLexLink(input)
    } catch {
      // Ignore parse errors
    }
  }

  return undefined
}
