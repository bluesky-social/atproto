/* eslint-disable import/no-deprecated */

import { CID } from 'multiformats/cid'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { assert, describe, expect, it } from 'vitest'
import {
  Cid,
  DAG_CBOR_MULTICODEC,
  RAW_MULTICODEC,
  SHA256_MULTIHASH,
  asMultiformatsCID,
  cidForRawHash,
  decodeCid,
  ensureValidCidString,
  isCid,
  parseCid,
  parseCidSafe,
} from './cid.js'
import { ui8Equals } from './uint8array.js'

const invalidCidStr = 'invalidcidstring'

const cborCidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
const cborCid = parseCid(cborCidStr, { flavor: 'cbor' })
assert(cborCid.code === DAG_CBOR_MULTICODEC)

const rawCidStr = 'bafkreifjjcie6lypi6ny7amxnfftagclbuxndqonfipmb64f2km2devei4'
const rawCid = parseCid(rawCidStr, { flavor: 'raw' })
assert(rawCid.code === RAW_MULTICODEC)

const customCid: Cid = {
  version: 1,
  code: RAW_MULTICODEC,
  multihash: {
    code: SHA256_MULTIHASH,
    digest: new Uint8Array(32),
  },
  bytes: new Uint8Array([
    0x01,
    RAW_MULTICODEC,
    SHA256_MULTIHASH,
    0x20,
    ...new Uint8Array(32),
  ]),
  toString() {
    return 'foobar' // Not implemented
  },
  equals(this: Cid, other: Cid) {
    return (
      this.version === other.version &&
      this.code === other.code &&
      this.multihash.code === other.multihash.code &&
      ui8Equals(this.multihash.digest, other.multihash.digest)
    )
  },
}

describe(isCid, () => {
  describe('non-strict mode', () => {
    it('returns true for parsed CIDs', () => {
      expect(isCid(cborCid)).toBe(true)
      expect(isCid(rawCid)).toBe(true)
    })

    it('returns true for custom compatible CID implementations', () => {
      expect(isCid(customCid)).toBe(true)
    })

    it('returns true for CID v0 and v1', async () => {
      const digest = await sha256.digest(Buffer.from('hello world'))
      const cidV0 = CID.createV0(digest)
      const cidV1 = CID.createV1(RAW_MULTICODEC, digest)
      expect(isCid(cidV0)).toBe(true)
      expect(isCid(cidV1)).toBe(true)
    })

    it('returns false for invalid CIDs', () => {
      expect(isCid(new Date())).toBe(false)
      expect(isCid({})).toBe(false)
      expect(isCid('not a cid')).toBe(false)
    })
  })

  describe('flavors', () => {
    describe('raw', () => {
      it('validated "raw" cids', async () => {
        const digest = await sha256.digest(Buffer.from('hello world'))
        const cid = CID.createV1(RAW_MULTICODEC, digest)
        expect(isCid(cid, { flavor: 'raw' })).toBe(true)
      })

      it('allows other hash algorithms', async () => {
        const digest = await sha512.digest(Buffer.from('hello world'))
        const cid = CID.createV1(RAW_MULTICODEC, digest)
        expect(isCid(cid, { flavor: 'raw' })).toBe(true)
      })

      it('rejects CID v0 when strict option is set', async () => {
        const digest = await sha256.digest(Buffer.from('hello world'))
        const cid = CID.createV0(digest)
        expect(isCid(cid, { flavor: 'raw' })).toBe(false)
      })

      it('rejects CIDs with invalid code', async () => {
        const digest = await sha256.digest(Buffer.from('hello world'))
        const cid = CID.createV1(3333, digest)
        expect(isCid(cid, { flavor: 'raw' })).toBe(false)
      })
    })

    describe('cbor', () => {
      it('validated "cbor" cids', async () => {
        const digest = await sha256.digest(Buffer.from('hello world'))
        const cid = CID.createV1(DAG_CBOR_MULTICODEC, digest)
        expect(isCid(cid, { flavor: 'cbor' })).toBe(true)
      })

      it('rejects CIDs with invalid hash algorithm', async () => {
        const digest = await sha512.digest(Buffer.from('hello world'))
        const cid = CID.createV1(RAW_MULTICODEC, digest)
        expect(isCid(cid, { flavor: 'cbor' })).toBe(false)
      })

      it('rejects CID v0 when strict option is set', async () => {
        const digest = await sha256.digest(Buffer.from('hello world'))
        const cid = CID.createV0(digest)
        expect(isCid(cid, { flavor: 'cbor' })).toBe(false)
      })

      it('rejects CIDs with invalid code', async () => {
        const digest = await sha256.digest(Buffer.from('hello world'))
        const cid = CID.createV1(3333, digest)
        expect(isCid(cid, { flavor: 'cbor' })).toBe(false)
      })
    })
  })

  describe('alternative cid implementations', () => {
    it('accepts compatible CID implementations', () => {
      expect(isCid(customCid)).toBe(true)
    })

    it('rejects non-matching version', () => {
      expect(isCid({ ...customCid, version: 0 })).toBe(false)
    })

    it('rejects non-matching code', () => {
      expect(isCid({ ...customCid, code: 0 })).toBe(false)
    })

    it('rejects non-matching multihash code', () => {
      expect(
        isCid({
          ...customCid,
          multihash: { ...customCid.multihash, code: 0 },
        }),
      ).toBe(false)
    })

    it('rejects non-matching multihash digest', () => {
      const differentDigest = new Uint8Array(32)
      differentDigest[0] = 1
      expect(
        isCid({
          ...customCid,
          multihash: { ...customCid.multihash, digest: differentDigest },
        }),
      ).toBe(false)
    })

    it('rejects objects without equals method', () => {
      expect(isCid({ ...customCid, equals: undefined })).toBe(false)
    })

    it('rejects object with throwing equals method', () => {
      expect(
        isCid({
          ...customCid,
          equals: () => {
            throw new Error('fail')
          },
        }),
      ).toBe(false)
    })
  })
})

describe(decodeCid, () => {
  it('decodes CID from bytes', () => {
    const cid = parseCid(cborCidStr)
    const bytes = cid.bytes
    const decodedCid = decodeCid(bytes)
    expect(decodedCid.toString()).toBe(cborCidStr)
  })
})

describe(parseCid, () => {
  it('parses valid CIDs', () => {
    expect(parseCid(cborCidStr).toString()).toBe(cborCidStr)
    expect(parseCid(rawCidStr).toString()).toBe(rawCidStr)
  })

  it('throws for invalid CIDs', () => {
    expect(() => parseCid(invalidCidStr)).toThrow()
  })
})

describe(parseCidSafe, () => {
  it('parses valid CIDs', () => {
    expect(parseCidSafe(cborCidStr)?.toString()).toBe(cborCidStr)
    expect(parseCidSafe(rawCidStr)?.toString()).toBe(rawCidStr)
  })

  it('returns undefined for invalid CIDs', () => {
    expect(parseCidSafe(invalidCidStr)).toBeNull()
  })
})

describe(ensureValidCidString, () => {
  it('does not throw for valid CIDs', () => {
    expect(() => ensureValidCidString(cborCidStr)).not.toThrow()
  })

  it('throws for invalid CIDs', () => {
    expect(() => ensureValidCidString(invalidCidStr)).toThrow(
      'Invalid CID string',
    )
  })
})

describe(cidForRawHash, () => {
  it('creates a RawCid from a SHA-256 hash', () => {
    const hash = new Uint8Array(32)
    const cid = cidForRawHash(hash)
    expect(cid.code).toBe(RAW_MULTICODEC)
    expect(cid.multihash.code).toBe(SHA256_MULTIHASH)
    expect(ui8Equals(cid.multihash.digest, hash)).toBe(true)
  })

  it('rejects hashes on invalid lengths', () => {
    expect(() => cidForRawHash(new Uint8Array(31))).toThrow(
      'Invalid SHA-256 hash length',
    )
    expect(() => cidForRawHash(new Uint8Array(33))).toThrow(
      'Invalid SHA-256 hash length',
    )
  })
})

describe(asMultiformatsCID, () => {
  it('converts compatible CID to multiformats CID', () => {
    for (const cid of [cborCid, rawCid, customCid]) {
      expect(asMultiformatsCID(cid)).toBeInstanceOf(CID)
      expect(asMultiformatsCID(cid)).toMatchObject({
        version: cid.version,
        code: cid.code,
        multihash: {
          code: cid.multihash.code,
          digest: cid.multihash.digest,
        },
      })
    }
  })
})
