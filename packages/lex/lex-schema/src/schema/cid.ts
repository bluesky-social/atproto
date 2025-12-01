import { Cid, isCid } from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../validation.js'

export type { Cid }

export type CidSchemaOptions = {
  /**
   * In strict mode, only CID with the following properties are accepted:
   * - version: 1
   * - codec: raw binary (0x55) or DAG-CBOR (0x71)
   * - hash function: SHA-256 (0x12)
   *
   * @default false
   */
  strict?: boolean
}

export class CidSchema extends Schema<Cid> {
  constructor(readonly options: CidSchemaOptions = {}) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Cid> {
    if (!isCid(input, this.options)) {
      return ctx.issueInvalidType(input, 'cid')
    }

    return ctx.success(input)
  }
}
