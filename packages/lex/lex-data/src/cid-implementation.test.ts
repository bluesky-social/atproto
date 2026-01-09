/* eslint-disable import/no-deprecated */

import { CID } from 'multiformats/cid'
import { create as createDigest } from 'multiformats/hashes/digest'
import { assert, describe, it } from 'vitest'
import { Cid } from './cid.js'
import { ui8Equals } from './uint8array.js'

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
