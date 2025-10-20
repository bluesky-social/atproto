import { CID } from 'multiformats/cid'
import { Infer, encodeIpldLink } from '../core.js'
import { CidSchema } from './cid.js'
import { IntegerSchema } from './integer.js'
import { LiteralSchema } from './literal.js'
import { ObjectSchema } from './object.js'
import { StringSchema } from './string.js'
import { UnionSchema } from './union.js'

// @NOTE Since the JsonBlobRef definition depends on various schemas (object,
// integer, etc.), we cannot place this file in ../core to avoid a circular
// dependency. An alternative would be to manually define the validator
// utilities bellow without using the other Lex* classes.

export const typedJsonBlobRef = new ObjectSchema(
  {
    $type: new LiteralSchema('blob'),
    ref: new CidSchema(),
    mimeType: new StringSchema({}),
    size: new IntegerSchema({ minimum: 0 }),
  },
  { unknownKeys: 'strict', required: ['$type', 'ref', 'mimeType', 'size'] },
)
export type TypedJsonBlobRef = Infer<typeof typedJsonBlobRef>

export const untypedJsonBlobRef = new ObjectSchema(
  {
    cid: new StringSchema({ format: 'cid' }),
    mimeType: new StringSchema({}),
  },
  { unknownKeys: 'strict', required: ['cid', 'mimeType'] },
)
export type UntypedJsonBlobRef = Infer<typeof untypedJsonBlobRef>

export const jsonBlobRef = new UnionSchema([
  typedJsonBlobRef,
  untypedJsonBlobRef,
])
export type JsonBlobRef = Infer<typeof jsonBlobRef>

export class BlobRef {
  constructor(
    public readonly ref: CID,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly original?: JsonBlobRef,
  ) {}

  toJSON() {
    // leave the original encoding so that we don't change CIDs on re-encode
    const { original } = this
    if (original) {
      if ('ref' in original) {
        const copy: Record<string, unknown> = { ...original }
        copy.ref = encodeIpldLink(original.ref)
        return copy
      } else {
        return original
      }
    }

    return {
      $type: 'blob',
      ref: { $link: this.ref.toString() },
      mimeType: this.mimeType,
      size: this.size,
    } as const
  }

  static fromJsonRef(json: JsonBlobRef): BlobRef {
    if (typedJsonBlobRef.$is(json)) {
      return BlobRef.fromTypedJsonRef(json)
    } else if (untypedJsonBlobRef.$is(json)) {
      return BlobRef.fromUntypedJsonRef(json)
    } else {
      throw new TypeError('Invalid JsonBlobRef object')
    }
  }

  static fromTypedJsonRef(json: TypedJsonBlobRef): BlobRef {
    return new BlobRef(json.ref, json.mimeType, json.size, json)
  }

  static fromUntypedJsonRef(json: UntypedJsonBlobRef): BlobRef {
    return new BlobRef(CID.parse(json.cid), json.mimeType, -1, json)
  }

  static asBlobRef(input: unknown): BlobRef | null {
    if (!input || typeof input !== 'object') {
      return null
    }

    if ('$type' in input) {
      const typedRes = typedJsonBlobRef.$validate(input)
      if (typedRes.success) {
        return BlobRef.fromTypedJsonRef(typedRes.value)
      }
    }

    if ('cid' in input && 'mimeType' in input) {
      const untypedRes = untypedJsonBlobRef.$validate(input)
      if (untypedRes.success) {
        return BlobRef.fromUntypedJsonRef(untypedRes.value)
      }
    }

    if (input instanceof BlobRef) {
      return input
    }

    return null
  }
}
