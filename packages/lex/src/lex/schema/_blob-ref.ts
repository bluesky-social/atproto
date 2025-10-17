import { CID } from 'multiformats/cid'
import { Infer } from '../core.js'
import { LexCidLink } from './cid-link.js'
import { LexInteger } from './integer.js'
import { LexLiteral } from './literal.js'
import { LexObject } from './object.js'
import { LexString } from './string.js'
import { LexUnion } from './union.js'

// @NOTE Since the JsonBlobRef definition depends on various schemas (object,
// integer, etc.), we cannot place this file in ../core to avoid a circular
// dependency. An alternative would be to manually define the validator
// utilities bellow without using the other Lex* classes.

export const typedJsonBlobRef = new LexObject(
  {
    $type: new LexLiteral('blob'),
    cid: new LexCidLink(),
    mimeType: new LexString({}),
    size: new LexInteger({ minimum: 0 }),
  },
  { unknownKeys: 'strict', required: ['$type', 'cid', 'mimeType', 'size'] },
)
export type TypedJsonBlobRef = Infer<typeof typedJsonBlobRef>

export const untypedJsonBlobRef = new LexObject(
  {
    cid: new LexString({ format: 'cid' }),
    mimeType: new LexString({}),
  },
  { unknownKeys: 'strict', required: ['cid', 'mimeType'] },
)
export type UntypedJsonBlobRef = Infer<typeof untypedJsonBlobRef>

export const jsonBlobRef = new LexUnion([typedJsonBlobRef, untypedJsonBlobRef])
export type JsonBlobRef = Infer<typeof jsonBlobRef>

export class BlobRef {
  readonly normalized: TypedJsonBlobRef

  constructor(readonly original: JsonBlobRef) {
    this.normalized =
      '$type' in original
        ? original
        : {
            $type: 'blob',
            cid: CID.parse(original.cid), // will throw if invalid
            mimeType: original.mimeType,
            size: -1,
          }
  }

  get $type(): 'blob' {
    return this.normalized.$type
  }

  get ref(): CID {
    return this.normalized.cid
  }

  get mimeType(): string {
    return this.normalized.mimeType
  }

  get size(): number {
    return this.normalized.size
  }

  toJSON() {
    return this.original
  }

  static fromJsonRef(json: JsonBlobRef): BlobRef {
    return new BlobRef(json)
  }

  static asBlobRef(input: unknown): BlobRef | null {
    if (!input) {
      return null
    }

    if (input instanceof BlobRef) {
      return input
    }

    const typedRes = typedJsonBlobRef.$validate(input)
    if (typedRes.success) {
      return new BlobRef(typedRes.value)
    }

    const untypedRes = untypedJsonBlobRef.$validate(input)
    if (untypedRes.success) {
      return new BlobRef(untypedRes.value)
    }

    return null
  }
}
