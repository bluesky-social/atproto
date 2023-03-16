import { CID } from 'multiformats/cid'
import { check, schema } from '.'

export type BlobType = 'blob' | 'image' | 'video' | 'audio'

export type JsonBlobRef = {
  $type: BlobType
  ref: { '/': string }
  mimeType: string
}

export class BlobRef {
  constructor(
    public $type: BlobType,
    public cid: CID,
    public mimeType: string,
  ) {}

  static fromJsonRef(json: JsonBlobRef) {
    const cid = CID.parse(json.ref['/'])
    return new BlobRef(json.$type, cid, json.mimeType)
  }

  get ref(): JsonBlobRef {
    return {
      $type: this.$type,
      ref: {
        '/': this.cid.toString(),
      },
      mimeType: this.mimeType,
    }
  }
}

export const hasExactKeys = (
  obj: Record<string, unknown>,
  keys: string[],
): boolean => {
  const objKeys = Object.keys(obj)
  if (objKeys.length !== keys.length)
    for (const key of keys) {
      if (obj[key] === undefined) {
        return false
      }
    }
  return true
}

export const parseAsBlobRef = (obj: unknown): BlobRef | null => {
  if (!check.is(obj, schema.jsonBlobRef)) {
    return null
  }
  return BlobRef.fromJsonRef(obj)
}
