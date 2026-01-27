import { CID } from 'multiformats/cid'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { describe, expect, it } from 'vitest'
import { BytesCid, createCustomCid } from './cid-implementation.test.js'
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
  isCidForBytes,
  parseCid,
  parseCidSafe,
} from './cid.js'
import { ui8Equals } from './uint8array.js'

const invalidCidStr = 'invalidcidstring'

const cborCidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
const cborCid = parseCid(cborCidStr, { flavor: 'cbor' })

const rawCidStr = 'bafkreifjjcie6lypi6ny7amxnfftagclbuxndqonfipmb64f2km2devei4'
const rawCid = parseCid(rawCidStr, { flavor: 'raw' })

const rawCidLike: Cid = createCustomCid(
  1,
  RAW_MULTICODEC,
  SHA256_MULTIHASH,
  rawCid.multihash.digest,
)
const rawBytesCid = new BytesCid(rawCid.bytes)

describe(isCid, () => {
  describe('non-strict mode', () => {
    it('returns true for parsed CIDs', () => {
      expect(isCid(cborCid)).toBe(true)
      expect(isCid(rawCid)).toBe(true)
    })

    it('returns true for custom compatible CID implementations', () => {
      expect(isCid(rawCidLike)).toBe(true)
      expect(isCid(rawBytesCid)).toBe(true)
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
      expect(isCid(rawCidLike)).toBe(true)
    })

    it('rejects non-matching version', () => {
      expect(isCid({ ...rawCidLike, version: 0 })).toBe(false)
    })

    it('rejects non-matching code', () => {
      expect(isCid({ ...rawCidLike, code: -1 })).toBe(false)
      expect(isCid({ ...rawCidLike, code: 0 })).toBe(false)
      expect(isCid({ ...rawCidLike, code: 256 })).toBe(false)
    })

    it('rejects invalid bytes property', () => {
      expect(isCid({ ...rawCidLike, bytes: undefined })).toBe(false)
      expect(isCid({ ...rawCidLike, bytes: 12 })).toBe(false)
      expect(isCid({ ...rawCidLike, bytes: {} })).toBe(false)
      expect(isCid({ ...rawCidLike, bytes: [] })).toBe(false)

      expect(
        isCid({
          ...rawCidLike,
          bytes: rawCidLike.bytes.subarray(0, rawCidLike.bytes.length - 1),
        }),
      ).toBe(false)

      const bytes = new Uint8Array(rawCidLike.bytes.length)

      bytes.set(rawCidLike.bytes)
      expect(isCid({ ...rawCidLike, bytes })).toBe(true)

      bytes[0] = bytes[0] ^ 0xff
      expect(isCid({ ...rawCidLike, bytes })).toBe(false)
      bytes.set(rawCidLike.bytes)

      bytes[3] = bytes[3] ^ 0xff
      expect(isCid({ ...rawCidLike, bytes })).toBe(false)
      bytes.set(rawCidLike.bytes)

      bytes[6] = bytes[6] ^ 0xff
      expect(isCid({ ...rawCidLike, bytes })).toBe(false)
      bytes.set(rawCidLike.bytes)
    })

    describe('multihash property', () => {
      it('rejects non-matching object', () => {
        expect(isCid({ ...rawCidLike, multihash: undefined })).toBe(false)
        expect(isCid({ ...rawCidLike, multihash: 12 })).toBe(false)
        expect(isCid({ ...rawCidLike, multihash: {} })).toBe(false)
        expect(isCid({ ...rawCidLike, multihash: [] })).toBe(false)
      })

      it('rejects non-matching code', () => {
        expect(
          isCid({
            ...rawCidLike,
            multihash: { ...rawCidLike.multihash, code: -1 },
          }),
        ).toBe(false)
        expect(
          isCid({
            ...rawCidLike,
            multihash: { ...rawCidLike.multihash, code: 0 },
          }),
        ).toBe(false)
        expect(
          isCid({
            ...rawCidLike,
            multihash: { ...rawCidLike.multihash, code: 256 },
          }),
        ).toBe(false)
      })

      it('rejects non Uint8Array digest', () => {
        expect(
          isCid({
            ...rawCidLike,
            multihash: { ...rawCidLike.multihash, digest: new Array(32) },
          }),
        ).toBe(false)
      })

      it('rejects non Uint8Array digest', () => {
        expect(
          isCid({
            ...rawCidLike,
            multihash: { ...rawCidLike.multihash, digest: new Array(32) },
          }),
        ).toBe(false)
      })

      it('rejects non-matching digest', () => {
        const differentDigest = new Uint8Array(32)
        differentDigest[0] = 1
        expect(
          isCid({
            ...rawCidLike,
            multihash: { ...rawCidLike.multihash, digest: differentDigest },
          }),
        ).toBe(false)
      })
    })

    describe('equals() method', () => {
      it('rejects objects without equals method', () => {
        expect(isCid({ ...rawCidLike, equals: undefined })).toBe(false)
        expect(isCid({ ...rawCidLike, equals: () => false })).toBe(false)
      })

      it('rejects object with throwing equals method', () => {
        expect(
          isCid({
            ...rawCidLike,
            equals: () => {
              throw new Error('fail')
            },
          }),
        ).toBe(false)
      })
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

describe(isCidForBytes, () => {
  describe('raw', () => {
    it('returns true for valid raw CID bytes', async () => {
      for (const hasher of [sha256, sha512]) {
        const data = new TextEncoder().encode('hello world')
        const digest = await hasher.digest(data)
        const cid = CID.createV1(RAW_MULTICODEC, digest)
        expect(await isCidForBytes(cid, data)).toBe(true)

        data[0] = data[0] ^ 0xff
        expect(await isCidForBytes(cid, data)).toBe(false)
      }
    })
  })

  describe('cbor', () => {
    it('returns true for valid cbor CID bytes', async () => {
      for (const hasher of [sha256, sha512]) {
        // @NOTE this is not valid CBOR, but sufficient for testing the hash
        const data = new TextEncoder().encode('hello world')
        const digest = await hasher.digest(data)
        const cid = CID.createV1(DAG_CBOR_MULTICODEC, digest)
        expect(await isCidForBytes(cid, data)).toBe(true)

        data[0] = data[0] ^ 0xff
        expect(await isCidForBytes(cid, data)).toBe(false)
      }
    })
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
    for (const cid of [cborCid, rawCid, rawCidLike, rawBytesCid]) {
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
