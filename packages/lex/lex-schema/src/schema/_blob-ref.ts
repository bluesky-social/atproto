import { CID } from '@atproto/lex-data'
import { Infer } from '../validation.js'
import { CidSchema } from './cid.js'
import { IntegerSchema } from './integer.js'
import { LiteralSchema } from './literal.js'
import { ObjectSchema } from './object.js'
import { StringSchema } from './string.js'
import { UnionSchema } from './union.js'

export const typedBlobRefSchema = new ObjectSchema(
  {
    $type: new LiteralSchema('blob'),
    ref: new CidSchema(),
    mimeType: new StringSchema({}),
    size: new IntegerSchema({ minimum: 0 }),
  },
  {
    required: ['$type', 'ref', 'mimeType', 'size'],
    unknownProperties: 'strict',
  },
)

export type TypedBlobRef = Infer<typeof typedBlobRefSchema>

export const untypedBlobRefSchema = new ObjectSchema(
  {
    cid: new StringSchema({ format: 'cid' }),
    mimeType: new StringSchema({}),
  },
  {
    required: ['cid', 'mimeType'],
    unknownProperties: 'strict',
  },
)

export type UntypedBlobRef = Infer<typeof untypedBlobRefSchema>

export const blobRefSchema = new UnionSchema([
  typedBlobRefSchema,
  untypedBlobRefSchema,
])

export type BlobRef = Infer<typeof blobRefSchema>

export function blobRefSize(blobRef: BlobRef): number {
  if (isTypedBlobRef(blobRef)) return blobRef.size
  return -1
}

export function blobRefCid(blobRef: BlobRef): CID {
  if (isTypedBlobRef(blobRef)) return blobRef.ref
  return CID.parse(blobRef.cid)
}

export function blobRefMimeType(blobRef: BlobRef): string {
  return blobRef.mimeType
}

export function buildBlobRef(
  ref: CID,
  mimeType: string,
  size: number,
): TypedBlobRef {
  return { $type: 'blob', ref, mimeType, size }
}

export function asBlobRef(input: unknown): BlobRef {
  return blobRefSchema.parse(input)
}

export function isBlobRef(input: unknown): input is BlobRef {
  return blobRefSchema.matches(input)
}

export function isTypedBlobRef(input: unknown): input is TypedBlobRef {
  return typedBlobRefSchema.matches(input)
}

export function asTypedBlobRef(input: unknown): TypedBlobRef {
  const typed = typedBlobRefSchema.validate(input)
  if (typed.success) return typed.value

  const untyped = untypedBlobRefSchema.validate(input)
  if (untyped.success) {
    const { cid, mimeType } = untyped.value
    return buildBlobRef(CID.parse(cid), mimeType, -1)
  }

  throw new Error('Invalid BlobRef')
}

export function isUntypedBlobRef(input: unknown): input is UntypedBlobRef {
  return untypedBlobRefSchema.matches(input)
}
