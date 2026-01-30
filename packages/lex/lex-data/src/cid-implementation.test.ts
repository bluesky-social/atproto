import { base32 } from 'multiformats/bases/base32'
import { CID } from 'multiformats/cid'
import { create as createDigest } from 'multiformats/hashes/digest'
import { assert, describe, expect, it } from 'vitest'
import { Cid } from './cid.js'
import { ui8Equals } from './uint8array.js'

export class BytesCid implements Cid {
  constructor(readonly bytes: Uint8Array) {
    if (this.bytes.length < 4) {
      throw new Error('CID bytes are too short')
    }
    if (this.bytes[0] > 1) {
      throw new Error('Unsupported CID version')
    }
    if (this.bytes.length !== 4 + this.bytes[3]) {
      throw new Error('CID bytes length mismatch')
    }
  }

  get version() {
    return this.bytes[0] as 0 | 1
  }

  get code() {
    return this.bytes[1]
  }

  get multihash() {
    const code = this.bytes[2]
    const digest = this.bytes.subarray(4)
    return { code, digest }
  }

  equals(other: Cid): boolean {
    return ui8Equals(this.bytes, other.bytes)
  }

  toString(): string {
    return base32.encode(this.bytes)
  }
}

describe(BytesCid, () => {
  it('creates a BytesCid from valid bytes', () => {
    const bytes = new Uint8Array([1, 0x55, 0x12, 3, 1, 2, 3])
    const cid = new BytesCid(bytes)

    assert(cid.version === 1)
    assert(cid.code === 0x55)
    assert(cid.multihash.code === 0x12)
    assert(ui8Equals(cid.multihash.digest, new Uint8Array([1, 2, 3])))
    assert(ui8Equals(cid.bytes, bytes))
    assert(typeof cid.toString === 'function')
    assert(typeof cid.equals === 'function')
  })

  it('throws an error for invalid CID bytes', () => {
    expect(
      () => new BytesCid(new Uint8Array([2, 0x55, 0x12, 3, 1, 2, 3])),
    ).toThrowError('Unsupported CID version')
    expect(() => new BytesCid(new Uint8Array([1, 0x55, 0x12]))).toThrowError(
      'CID bytes are too short',
    )
    expect(
      () => new BytesCid(new Uint8Array([1, 0x55, 0x12, 4, 1, 2, 3])),
    ).toThrowError('CID bytes length mismatch')
  })
})

/**
 * A minimal custom implementation of the `Cid` interface for testing purposes.
 */
export function createCustomCid<
  TVersion extends 0 | 1,
  TCode extends number,
  TMultihashCode extends number,
>(
  version: TVersion,
  code: TCode,
  multihashCode: TMultihashCode,
  digest: Uint8Array,
): Cid<TVersion, TCode, TMultihashCode> {
  return {
    version,
    code,
    multihash: { code: multihashCode, digest },
    bytes: new Uint8Array([
      version,
      code,
      multihashCode,
      digest.length,
      ...digest,
    ]),
    toString,
    equals,
  }
}

function equals(this: Cid, other: Cid): boolean {
  return (
    this.version === other.version &&
    this.code === other.code &&
    this.multihash.code === other.multihash.code &&
    ui8Equals(this.multihash.digest, other.multihash.digest)
  )
}

function toString(this: Cid): string {
  return CID.create(
    this.version,
    this.code,
    createDigest(this.multihash.code, this.multihash.digest),
  ).toString()
}

describe(createCustomCid, () => {
  it('creates a CID with the specified properties', () => {
    const digest = new Uint8Array([1, 2, 3, 4, 5])
    const customCid = createCustomCid(1, 0x55, 0x12, digest)

    assert(customCid.version === 1)
    assert(customCid.code === 0x55)
    assert(customCid.multihash.code === 0x12)
    assert(ui8Equals(customCid.multihash.digest, digest))
    assert(
      ui8Equals(
        customCid.bytes,
        new Uint8Array([1, 0x55, 0x12, 5, 1, 2, 3, 4, 5]),
      ),
    )
    assert(typeof customCid.toString === 'function')
    assert(typeof customCid.equals === 'function')
  })
})
