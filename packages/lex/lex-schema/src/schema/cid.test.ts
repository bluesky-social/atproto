import { parseCid } from '@atproto/lex-data'
import { CidSchema } from './cid.js'

describe('CidSchema', () => {
  describe('default mode (non-strict)', () => {
    const schema = new CidSchema()

    it('validates CID v1 with DAG-CBOR codec and SHA-256', () => {
      const cid = parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      )
      const result = schema.safeParse(cid)
      expect(result.success).toBe(true)
    })

    it('validates CID v1 with raw binary codec', () => {
      const cid = parseCid(
        'bafkreifjjcie6lypi6ny7amxnfftagclbuxndqonfipmb64f2km2devei4',
      )
      const result = schema.safeParse(cid)
      expect(result.success).toBe(true)
    })

    it('validates CID v0', () => {
      const cid = parseCid('QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB')
      const result = schema.safeParse(cid)
      expect(result.success).toBe(true)
    })

    it('validates multiple different CIDs', () => {
      const cids = [
        parseCid('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
        parseCid('bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q'),
        parseCid('bafyreiaizynclnqiolq7byfpjjtgqzn4sfrsgn7z2hhf6bo4utdwkin7ke'),
        parseCid('bafyreifd4w4tcr5tluxz7osjtnofffvtsmgdqcfrfi6evjde4pl27lrjpy'),
      ]

      for (const cid of cids) {
        const result = schema.safeParse(cid)
        expect(result.success).toBe(true)
      }
    })

    it('rejects non-CID objects', () => {
      const result = schema.safeParse({ not: 'a cid' })
      expect(result.success).toBe(false)
    })

    it('rejects strings', () => {
      const result = schema.safeParse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      )
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
    const schema = new CidSchema({ strict: true })

    it('validates CID v1 with DAG-CBOR codec and SHA-256', () => {
      const cid = parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      )
      const result = schema.safeParse(cid)
      expect(result.success).toBe(true)
    })

    it('validates CID v1 with raw binary codec and SHA-256', () => {
      const cid = parseCid(
        'bafkreifjjcie6lypi6ny7amxnfftagclbuxndqonfipmb64f2km2devei4',
      )
      const result = schema.safeParse(cid)
      expect(result.success).toBe(true)
    })

    it('rejects CID v0', () => {
      const cid = parseCid('QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB')
      const result = schema.safeParse(cid)
      expect(result.success).toBe(false)
    })

    it('rejects CID v1 with non-standard codec', () => {
      // Using git-raw codec (0x78) instead of DAG-CBOR or raw binary
      const cid = parseCid(
        'bafybeigvgzoolc3drupxhlevdp2ugqcrbcsqfmcek2zxiw5wctk3xjpjwy',
      )
      const result = schema.safeParse(cid)
      expect(result.success).toBe(false)
    })

    it('rejects CID v1 with non-SHA-256 hash', () => {
      // Using SHA-512 (0x13) instead of SHA-256
      const cid = parseCid(
        'bafybgqfcn3rz4mdzywp2jb6mjvpdq24rxjvbmdcmizrjdgx2ujjpvj4kxf4d62ywrzm6njk44cxhha4pj3bkvqz2esfgrm7mdkdcqcxjibf7c',
      )
      const result = schema.safeParse(cid)
      expect(result.success).toBe(false)
    })

    it('rejects non-CID objects', () => {
      const result = schema.safeParse({ not: 'a cid' })
      expect(result.success).toBe(false)
    })

    it('rejects strings', () => {
      const result = schema.safeParse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      )
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })
  })

  describe('options', () => {
    it('stores the provided options', () => {
      const options = { strict: true }
      const schema = new CidSchema(options)
      expect(schema.options).toEqual(options)
    })

    it('defaults to empty options', () => {
      const schema = new CidSchema()
      expect(schema.options).toEqual({})
    })
  })
})
