import { assert, describe, expect, it } from 'vitest'
import { isLegacyBlobRef, isTypedBlobRef, parseCid } from '@atproto/lex-data'
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
      assert(result.success)
      assert(isTypedBlobRef(result.value))
      expect(result.value.$type).toBe('blob')
      expect(result.value.mimeType).toBe('image/jpeg')
      expect(result.value.size).toBe(10000)
    })

    it('validates blob with different mime types', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/png',
        size: 5000,
      })
      assert(result.success)
    })

    it('validates blob with size 0', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'text/plain',
        size: 0,
      })
      assert(result.success)
    })

    it('rejects non-objects', () => {
      const result = schema.safeParse('not an object')
      assert(!result.success)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      assert(!result.success)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      assert(!result.success)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse([])
      assert(!result.success)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(123)
      assert(!result.success)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      assert(!result.success)
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
      assert(!result.success)
    })

    it('rejects blob with wrong $type', () => {
      const result = schema.safeParse({
        $type: 'notblob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob without ref', () => {
      const result = schema.safeParse({
        $type: 'blob',
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob without mimeType', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob without size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
      })
      assert(!result.success)
    })

    it('rejects blob with invalid ref type', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: 'not a cid',
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob with invalid mimeType type', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 123,
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob with invalid size type', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: '10000',
      })
      assert(!result.success)
    })

    it('rejects blob with negative size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: -1,
      })
      assert(!result.success)
    })

    it('rejects blob with decimal size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000.5,
      })
      assert(!result.success)
    })

    it('rejects blob with extra properties', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
        extra: 'not allowed',
      })
      assert(!result.success)
    })

    it('rejects blob with $link format for ref', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: { $link: blobCid.toString() },
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob with unknown properties', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
        unknownProp: 42,
      })
      assert(!result.success)
    })
  })

  describe('strict validation', () => {
    const schema = blob()

    it('accepts valid raw CID in strict mode', () => {
      const result = schema.safeParse(
        {
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        },
        { strict: true },
      )
      assert(result.success)
    })

    it('rejects non-raw CID in strict mode', () => {
      const result = schema.safeParse(
        {
          $type: 'blob',
          ref: lexCid,
          mimeType: 'image/jpeg',
          size: 10000,
        },
        { strict: true },
      )
      assert(!result.success)
    })

    it('accepts non-raw CID in non-strict mode', () => {
      const result = schema.safeParse(
        {
          $type: 'blob',
          ref: lexCid,
          mimeType: 'image/jpeg',
          size: 10000,
        },
        { strict: false },
      )
      assert(result.success)
    })
  })

  describe('legacy blob format', () => {
    it('rejects legacy format by default (strict mode)', () => {
      const schema = blob({})
      const parseResult = schema.safeParse({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      assert(!parseResult.success)

      const validateResult = schema.safeValidate({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      assert(!validateResult.success)
    })

    it('rejects legacy format when strict: true is explicit', () => {
      const schema = blob({})
      const parseResult = schema.safeParse(
        {
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
        },
        { strict: true },
      )
      assert(!parseResult.success)

      const validateResult = schema.safeValidate(
        {
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
        },
        { strict: true },
      )
      assert(!validateResult.success)
    })

    it('accepts legacy format with strict: false in both parse and validate', () => {
      const schema = blob({})
      const parseResult = schema.safeParse(
        {
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
        },
        { strict: false },
      )
      assert(parseResult.success)
      assert(isLegacyBlobRef(parseResult.value))
      expect(parseResult.value).toMatchObject({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      expect(parseResult.value.cid).toBe(blobCid.toString())

      const validateResult = schema.safeValidate(
        {
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
        },
        { strict: false },
      )
      assert(validateResult.success)
      assert(isLegacyBlobRef(validateResult.value))
    })

    it('accepts legacy format with lexCid in non-strict mode', () => {
      const schema = blob({})
      const result = schema.safeParse(
        {
          cid: lexCid.toString(),
          mimeType: 'image/png',
        },
        { strict: false },
      )
      assert(result.success)
    })

    it('rejects legacy format without cid', () => {
      const schema = blob({})
      const result = schema.safeParse(
        {
          mimeType: 'image/jpeg',
        },
        { strict: false },
      )
      assert(!result.success)
    })

    it('rejects legacy format without mimeType', () => {
      const schema = blob({})
      const result = schema.safeParse(
        {
          cid: blobCid.toString(),
        },
        { strict: false },
      )
      assert(!result.success)
    })

    it('rejects legacy format with invalid cid', () => {
      const schema = blob({})
      const result = schema.safeParse(
        {
          cid: 'invalid-cid',
          mimeType: 'image/jpeg',
        },
        { strict: false },
      )
      assert(!result.success)
    })

    it('rejects legacy format with numeric cid', () => {
      const schema = blob({})
      const result = schema.safeParse(
        {
          cid: 123,
          mimeType: 'image/jpeg',
        },
        { strict: false },
      )
      assert(!result.success)
    })

    it('rejects legacy format with extra properties', () => {
      const schema = blob({})
      const result = schema.safeParse(
        {
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
          extra: 'not allowed',
        },
        { strict: false },
      )
      assert(!result.success)
    })

    it('accepts standard BlobRef always, LegacyBlobRef only with strict: false', () => {
      const schema = blob({})

      const blobRefResult = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(blobRefResult.success)

      const legacyResultStrict = schema.safeParse({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      })
      assert(!legacyResultStrict.success)

      const legacyResultNonStrict = schema.safeParse(
        {
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
        },
        { strict: false },
      )
      assert(legacyResultNonStrict.success)
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
      assert(!result.success)
    })

    it('accepts blob with maxSize option (not enforced)', () => {
      const schema = blob({ maxSize: 1000 })
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(!result.success)
    })

    it('accepts blob matching accept constraint', () => {
      const schema = blob({ accept: ['image/jpeg', 'image/png'] })
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(result.success)
    })

    it('accepts blob matching maxSize constraint', () => {
      const schema = blob({ maxSize: 20000 })
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(result.success)
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
      assert(result.success)
    })

    it('rejects empty object', () => {
      const result = schema.safeParse({})
      assert(!result.success)
    })

    it('rejects object with only $type', () => {
      const result = schema.safeParse({ $type: 'blob' })
      assert(!result.success)
    })

    it('rejects blob with empty mimeType', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: '',
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob with null ref', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: null,
        mimeType: 'image/jpeg',
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob with null mimeType', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: null,
        size: 10000,
      })
      assert(!result.success)
    })

    it('rejects blob with null size', () => {
      const result = schema.safeParse({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: null,
      })
      assert(!result.success)
    })
  })

  describe('legacy blob format with strict mode combinations', () => {
    const schema = blob()

    describe('strict: true (default)', () => {
      it('rejects legacy blob format by default', () => {
        const parseResult = schema.safeParse({
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
        })
        assert(!parseResult.success)

        const validateResult = schema.safeValidate({
          cid: blobCid.toString(),
          mimeType: 'image/jpeg',
        })
        assert(!validateResult.success)
      })

      it('accepts standard BlobRef', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        })
        assert(result.success)
      })
    })

    describe('strict: false', () => {
      it('accepts legacy blob format in both parse and validate', () => {
        const parseResult = schema.safeParse(
          {
            cid: blobCid.toString(),
            mimeType: 'image/jpeg',
          },
          { strict: false },
        )
        assert(parseResult.success)

        const validateResult = schema.safeValidate(
          {
            cid: blobCid.toString(),
            mimeType: 'image/jpeg',
          },
          { strict: false },
        )
        assert(validateResult.success)
      })

      it('accepts legacy blob format with lexCid', () => {
        const result = schema.safeParse(
          {
            cid: lexCid.toString(),
            mimeType: 'image/png',
          },
          { strict: false },
        )
        assert(result.success)
      })

      it('accepts standard BlobRef with non-raw CID', () => {
        const result = schema.safeParse(
          {
            $type: 'blob',
            ref: lexCid,
            mimeType: 'image/jpeg',
            size: 10000,
          },
          { strict: false },
        )
        assert(result.success)
      })
    })
  })

  describe('mime and size checks depend on strict mode', () => {
    describe('accept constraint', () => {
      const schema = blob({ accept: ['image/jpeg', 'image/png'] })

      it('rejects non-matching mime type in strict mode (default)', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/gif',
          size: 10000,
        })
        assert(!result.success)
      })

      it('accepts non-matching mime type in non-strict mode', () => {
        const result = schema.safeParse(
          {
            $type: 'blob',
            ref: blobCid,
            mimeType: 'image/gif',
            size: 10000,
          },
          { strict: false },
        )
        assert(result.success)
      })

      it('accepts matching mime type in strict mode', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        })
        assert(result.success)
      })
    })

    describe('maxSize constraint', () => {
      const schema = blob({ maxSize: 1000 })

      it('rejects oversized blob in strict mode (default)', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 5000,
        })
        assert(!result.success)
      })

      it('accepts oversized blob in non-strict mode', () => {
        const result = schema.safeParse(
          {
            $type: 'blob',
            ref: blobCid,
            mimeType: 'image/jpeg',
            size: 5000,
          },
          { strict: false },
        )
        assert(result.success)
      })

      it('accepts correctly sized blob in strict mode', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 500,
        })
        assert(result.success)
      })
    })

    describe('combined accept and maxSize constraints', () => {
      const schema = blob({
        accept: ['image/jpeg'],
        maxSize: 20000,
      })

      it('accepts valid blob in strict mode', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        })
        assert(result.success)
      })

      it('rejects wrong mime in strict mode', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/png',
          size: 10000,
        })
        assert(!result.success)
      })

      it('rejects oversized in strict mode', () => {
        const result = schema.safeParse({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 30000,
        })
        assert(!result.success)
      })

      it('accepts wrong mime and oversized in non-strict mode', () => {
        const result = schema.safeParse(
          {
            $type: 'blob',
            ref: blobCid,
            mimeType: 'video/mp4',
            size: 99999,
          },
          { strict: false },
        )
        assert(result.success)
      })
    })
  })
})
