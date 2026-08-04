import {
  LexMap,
  TypedBlobRef,
  TypedLexMap,
  enumBlobRefs,
  isLegacyBlobRef,
} from '@atproto/lex-data'
import { NsidString, RecordKeyString, isValidRecordKey } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { hasExplicitSlur } from '../../../../handle/explicit-slurs.js'
import { ValidationStatus, validateRecord } from '../../../../repo/index.js'

// The same preparation a public repo write gets, applied to a space record.
export function prepareSpaceWrite(opts: {
  collection: NsidString
  rkey: string
  record: LexMap
  validate?: boolean
  validationPath?: (string | number)[]
}): {
  record: TypedLexMap
  blobs: TypedBlobRef[]
  validationStatus?: ValidationStatus
} {
  const { collection, rkey, validate, validationPath } = opts

  const record: null | TypedLexMap =
    opts.record.$type === undefined
      ? { ...opts.record, $type: collection }
      : opts.record.$type === collection
        ? (opts.record as TypedLexMap)
        : null

  if (!record) {
    throw new InvalidRequestError(
      `Invalid $type: expected ${collection}, got ${opts.record.$type}`,
      'InvalidRecord',
    )
  }

  if (!isValidRecordKey(rkey)) {
    throw new InvalidRequestError(
      `Invalid record key: ${rkey}`,
      'InvalidRecord',
    )
  }
  if (hasExplicitSlur(rkey)) {
    throw new InvalidRequestError(
      'Unacceptable slur in record key',
      'InvalidRecord',
    )
  }

  // @NOTE validate before enumerating blobs, so a schema error is reported in
  // preference to a legacy-blob error.
  let validationStatus: ValidationStatus | undefined
  try {
    validationStatus = validateRecord(record, rkey as RecordKeyString, {
      validate,
      validationPath,
    })
  } catch (err) {
    throw new InvalidRequestError(
      err instanceof Error ? err.message : String(err),
      'InvalidRecord',
    )
  }

  const blobs = Array.from(
    enumBlobRefs(record, { strict: false, allowLegacy: true }),
    (blob) => {
      if (isLegacyBlobRef(blob)) {
        throw new InvalidRequestError(
          `Legacy blobs are not allowed (${blob.cid})`,
          'InvalidRecord',
        )
      }
      return blob
    },
  )

  return { record, blobs, validationStatus }
}
