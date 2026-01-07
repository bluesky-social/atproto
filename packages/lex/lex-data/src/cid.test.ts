import { CID } from 'multiformats/cid'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { describe, expect, it } from 'vitest'
import {
  DAG_CBOR_MULTICODEC,
  RAW_MULTICODEC,
  decodeCid,
  ensureValidCidString,
  isCid,
  parseCid,
  parseCidString,
} from './cid.js'

describe(isCid, () => {
  describe('non-strict mode', () => {
    it('returns true for parsed CIDs', () => {
      const cid = parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      )
      expect(isCid(cid)).toBe(true)
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
})

describe(decodeCid, () => {
  it('decodes CID from bytes', () => {
    const cidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
    const cid = parseCid(cidStr)
    const bytes = cid.bytes
    const decodedCid = decodeCid(bytes)
    expect(decodedCid.toString()).toBe(cidStr)
  })
})

describe(parseCid, () => {
  it('parses valid CIDs', () => {
    const cidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
    const cid = parseCid(cidStr)
    expect(cid.toString()).toBe(cidStr)
  })

  it('throws for invalid CIDs', () => {
    const invalidCidStr = 'invalidcidstring'
    expect(() => parseCid(invalidCidStr)).toThrow()
  })
})

describe(parseCidString, () => {
  it('parses valid CIDs', () => {
    const cidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
    const cid = parseCidString(cidStr)
    expect(cid).toBeDefined()
    expect(cid!.toString()).toBe(cidStr)
  })

  it('returns undefined for invalid CIDs', () => {
    const invalidCidStr = 'invalidcidstring'
    const cid = parseCidString(invalidCidStr)
    expect(cid).toBeUndefined()
  })
})

describe(ensureValidCidString, () => {
  it('does not throw for valid CIDs', () => {
    const cidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
    expect(() => ensureValidCidString(cidStr)).not.toThrow()
  })

  it('throws for invalid CIDs', () => {
    const invalidCidStr = 'invalidcidstring'
    expect(() => ensureValidCidString(invalidCidStr)).toThrow(
      'Invalid CID string',
    )
  })
})
