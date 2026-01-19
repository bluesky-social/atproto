import { describe, expect, it } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import { cid } from './cid.js'

const cborCid = parseCid(
  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
  { flavor: 'cbor' },
)

const rawCid = parseCid(
  'bafkreifjjcie6lypi6ny7amxnfftagclbuxndqonfipmb64f2km2devei4',
  { flavor: 'raw' },
)

const v0Cid = parseCid('QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB')

// Using git-raw codec (0x78) instead of DAG-CBOR or raw binary
const gitRawCid = parseCid(
  'bafybeigvgzoolc3drupxhlevdp2ugqcrbcsqfmcek2zxiw5wctk3xjpjwy',
)

// Using SHA-512 (0x13) instead of SHA-256
const sha512Cid = parseCid(
  'bafybgqfcn3rz4mdzywp2jb6mjvpdq24rxjvbmdcmizrjdgx2ujjpvj4kxf4d62ywrzm6njk44cxhha4pj3bkvqz2esfgrm7mdkdcqcxjibf7c',
)

describe('CidSchema', () => {
  describe('default mode (non-strict)', () => {
    const schema = cid({})

    it('validates CID v1 with DAG-CBOR codec and SHA-256', () => {
      const result = schema.safeParse(cborCid)
      expect(result.success).toBe(true)
    })

    it('validates CID v1 with raw binary codec', () => {
      const result = schema.safeParse(rawCid)
      expect(result.success).toBe(true)
    })

    it('validates CID v0', () => {
      const result = schema.safeParse(v0Cid)
      expect(result.success).toBe(true)
    })

    it('rejects non-CID objects', () => {
      const result = schema.safeParse({ not: 'a cid' })
      expect(result.success).toBe(false)
    })

    it('rejects strings', () => {
      const result = schema.safeParse(cborCid.toString())
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse([])
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })
  })

  describe('strict mode', () => {
    const schema = cid({ flavor: 'dasl' })

    it('validates CID v1 with DAG-CBOR codec and SHA-256', () => {
      const result = schema.safeParse(cborCid)
      expect(result.success).toBe(true)
    })

    it('validates CID v1 with raw binary codec and SHA-256', () => {
      const result = schema.safeParse(rawCid)
      expect(result.success).toBe(true)
    })

    it('rejects CID v0', () => {
      const result = schema.safeParse(v0Cid)
      expect(result.success).toBe(false)
    })

    it('rejects CID v1 with non-standard codec', () => {
      const result = schema.safeParse(gitRawCid)
      expect(result.success).toBe(false)
    })

    it('rejects CID v1 with non-SHA-256 hash', () => {
      const result = schema.safeParse(sha512Cid)
      expect(result.success).toBe(false)
    })

    it('rejects non-CID objects', () => {
      const result = schema.safeParse({ not: 'a cid' })
      expect(result.success).toBe(false)
    })

    it('rejects strings', () => {
      const result = schema.safeParse(cborCid.toString())
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })
  })
})
