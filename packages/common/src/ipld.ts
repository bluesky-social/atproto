import crypto from 'crypto'
import { Transform, TransformCallback } from 'stream'
import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as rawCodec from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import * as mf from 'multiformats'
import * as cborCodec from '@ipld/dag-cbor'
import { check, schema } from '.'

export const dataToCborBlock = async (data: unknown) => {
  return Block.encode({
    value: data,
    codec: cborCodec,
    hasher: sha256,
  })
}

export const verifyCidForBytes = async (cid: CID, bytes: Uint8Array) => {
  const digest = await sha256.digest(bytes)
  const expected = CID.createV1(cid.code, digest)
  if (!cid.equals(expected)) {
    throw new Error(
      `Not a valid CID for bytes. Expected: ${expected.toString()} Got: ${cid.toString()}`,
    )
  }
}

export const sha256RawToCid = (hash: Uint8Array): CID => {
  const digest = mf.digest.create(sha256.code, hash)
  return CID.createV1(rawCodec.code, digest)
}

export const cidForCbor = async (data: unknown): Promise<CID> => {
  const block = await dataToCborBlock(data)
  return block.cid
}

export const cborEncode = cborCodec.encode
export const cborDecode = cborCodec.decode

export const cborBytesToRecord = (
  bytes: Uint8Array,
): Record<string, unknown> => {
  const val = cborDecode(bytes)
  if (!check.is(val, schema.record)) {
    throw new Error(`Expected object, got: ${val}`)
  }
  return val
}

export class VerifyCidTransform extends Transform {
  hasher = crypto.createHash('sha256')
  constructor(public cid: CID) {
    super()
  }

  _transform(chunk: Uint8Array, _enc: BufferEncoding, cb: TransformCallback) {
    this.hasher.update(chunk)
    cb(null, chunk)
  }

  _flush(cb: TransformCallback) {
    try {
      const cid = sha256RawToCid(this.hasher.digest())
      if (this.cid.equals(cid)) {
        return cb()
      } else {
        return cb(new VerifyCidError(this.cid, cid))
      }
    } catch (_err) {
      const err =
        _err instanceof Error
          ? _err
          : new Error('Unexpected error', { cause: _err })
      return cb(err)
    }
  }
}

export class VerifyCidError extends Error {
  constructor(public expected: CID, public actual: CID) {
    super('Bad cid check')
  }
}
