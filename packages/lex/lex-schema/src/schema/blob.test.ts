import { describe, expect, it } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import { blob } from './blob.js'

// await cidForRawBytes(Buffer.from('Hello, World!'))
const blobCid = parseCid(
  'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
)
// await cidForLex(Buffer.from('Hello, World!'))
const lexCid = parseCid(
  'bafyreic52vzks7wdklat4evp3vimohl55i2unzqpshz2ytka5omzr7exdy',
)

describe('BlobSchema', () => {
  describe('basic validation', () => {
    const schema = blob({})

    it('validates valid blob references', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('blob')
        expect(result.value.mimeType).toBe('image/jpeg')
        expect(result.value.size).toBe(10000)
      }
    })

    it('validates blob with different mime types', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/png',
        size: 5000,
      })
      expect(result.success).toBe(true)
    })

    it('validates blob with size 0', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'text/plain',
        size: 0,
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-objects', () => {
      const result = schema.safeParse('not an object')
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

    it('rejects numbers', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })
  })

  describe('BlobRef validation', () => {
    const schema = blob({})

    it('rejects blob without $type', () => {
      const result = schema.safeParse({
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with wrong $type', () => {
      const result = schema.safeParse({
        $type: 'notblob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob without ref', () => {
      const result = schema.safeParse({
        $type: 'blob',
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob without mimeType', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob without size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with invalid ref type', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: 'not a cid',
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with invalid mimeType type', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 123,
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with invalid size type', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: '10000',
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with negative size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: -1,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with decimal size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000.5,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with extra properties', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
        extra: 'not allowed',
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with $link format for ref', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: { $link: blobCid.toString() },
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with unknown properties', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
        unknownProp: 42,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('strict validation', () => {
    const strictSchema = blob({ strict: true })

    it('accepts valid raw CID in strict mode', () => {
      const result = strictSchema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-raw CID in strict mode', () => {
      const result = strictSchema.safeParse({
        $type: 'blob',
        ref: lexCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('accepts non-raw CID in non-strict mode', () => {
      const nonStrictSchema = blob({ strict: false })
      const result = nonStrictSchema.safeParse({
        $type: 'blob',
        ref: lexCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('legacy blob format', () => {
    it('rejects legacy format by default', () => {
      const schema = blob({})
      const result = schema.safeParse({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      expect(result.success).toBe(false)
    })

    it('accepts legacy format when allowLegacy is true', () => {
      const schema = blob({ allowLegacy: true })
      const result = schema.safeParse({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect('cid' in result.value && result.value.cid).toBe(
          blobCid.toString(),
        )
        expect(result.value.mimeType).toBe('image/jpeg')
      }
    })

    it('accepts legacy format with lexCid when allowLegacy is true', () => {
      const schema = blob({ allowLegacy: true })
      const result = schema.safeParse({
        cid: lexCid.toString(),
        mimeType: 'image/png',
      })
      expect(result.success).toBe(true)
    })

    it('rejects legacy format without cid', () => {
      const schema = blob({ allowLegacy: true })
      const result = schema.safeParse({
        mimeType: 'image/jpeg',
      })
      expect(result.success).toBe(false)
    })

    it('rejects legacy format without mimeType', () => {
      const schema = blob({ allowLegacy: true })
      const result = schema.safeParse({
        cid: blobCid.toString(),
      })
      expect(result.success).toBe(false)
    })

    it('rejects legacy format with invalid cid', () => {
      const schema = blob({ allowLegacy: true })
      const result = schema.safeParse({
        cid: 'invalid-cid',
        mimeType: 'image/jpeg',
      })
      expect(result.success).toBe(false)
    })

    it('rejects legacy format with numeric cid', () => {
      const schema = blob({ allowLegacy: true })
      const result = schema.safeParse({
        cid: 123,
        mimeType: 'image/jpeg',
      })
      expect(result.success).toBe(false)
    })

    it('rejects legacy format with extra properties', () => {
      const schema = blob({ allowLegacy: true })
      const result = schema.safeParse({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
        extra: 'not allowed',
      })
      expect(result.success).toBe(false)
    })

    it('accepts both BlobRef and LegacyBlobRef formats when allowLegacy is true', () => {
      const schema = blob({ allowLegacy: true })

      const blobRefResult = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(blobRefResult.success).toBe(true)

      const legacyResult = schema.safeParse({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      expect(legacyResult.success).toBe(true)
    })
  })

  describe('accept and maxSize options', () => {
    it('accepts blob with accept option (not enforced)', () => {
      const schema = blob({ accept: ['image/jpeg', 'image/png'] })
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/gif',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('accepts blob with maxSize option (not enforced)', () => {
      const schema = blob({ maxSize: 1000 })
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('accepts blob matching accept constraint', () => {
      const schema = blob({ accept: ['image/jpeg', 'image/png'] })
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(true)
    })

    it('accepts blob matching maxSize constraint', () => {
      const schema = blob({ maxSize: 20000 })
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    const schema = blob({})

    it('validates blob with large size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'video/mp4',
        size: Number.MAX_SAFE_INTEGER,
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty object', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects object with only $type', () => {
      const result = schema.safeParse({ $type: 'blob' })
      expect(result.success).toBe(false)
    })

    it('rejects blob with empty mimeType', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: '',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with null ref', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: null,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with null mimeType', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: null,
        size: 10000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects blob with null size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: null,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('combined options', () => {
    it('validates with strict and allowLegacy both true', () => {
      const schema = blob({ strict: true, allowLegacy: true })

      // Should accept strict BlobRef
      const blobRefResult = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(blobRefResult.success).toBe(true)

      // Should accept LegacyBlobRef
      const legacyResult = schema.safeParse({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      expect(legacyResult.success).toBe(true)

      // Should reject non-raw CID in BlobRef format
      const nonRawResult = schema.safeParse({
        $type: 'blob',
        ref: lexCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(nonRawResult.success).toBe(false)
    })

    it('validates with all options combined', () => {
      const schema = blob({
        strict: true,
        allowLegacy: true,
        accept: ['image/jpeg'],
        maxSize: 20000,
      })

      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      expect(result.success).toBe(true)
    })
  })
})
