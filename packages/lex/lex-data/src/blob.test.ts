import { describe, expect, it } from 'vitest'
import {
  BlobRef,
  LegacyBlobRef,
  enumBlobRefs,
  isBlobRef,
  isLegacyBlobRef,
} from './blob.js'
import { RawCid, parseCid } from './cid.js'
import { LexArray, LexMap, LexValue } from './lex.js'

// await cidForRawBytes(Buffer.from('Hello, World!'))
const validBlobCid = parseCid(
  'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
  { flavor: 'raw' },
)

// await cidForLex(Buffer.from('Hello, World!'))
const invalidBlobCid = parseCid(
  'bafyreic52vzks7wdklat4evp3vimohl55i2unzqpshz2ytka5omzr7exdy',
  { flavor: 'cbor' },
)

describe(isBlobRef, () => {
  it('tests valid blobCid and lexCid', () => {
    expect(validBlobCid.code).toBe(0x55) // raw
    expect(validBlobCid.multihash.code).toBe(0x12) // sha2-256
    expect(invalidBlobCid.code).toBe(0x71) // dag-cbor
    expect(invalidBlobCid.multihash.code).toBe(0x12) // sha2-256
  })

  it('parses valid blob', () => {
    expect(
      isBlobRef({
        $type: 'blob',
        ref: validBlobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      }),
    ).toBe(true)

    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: invalidBlobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        },
        // In non-strict mode, any CID should be accepted
        { strict: false },
      ),
    ).toBe(true)
  })

  it('performs strict validation by default', () => {
    expect(
      isBlobRef({
        $type: 'blob',
        ref: invalidBlobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      }),
    ).toBe(false)
  })

  it('rejects invalid inputs', () => {
    expect(
      isBlobRef({
        $type: 'blob',
        ref: { $link: validBlobCid.toString() },
        mimeType: 'image/jpeg',
        size: '10000',
      }),
    ).toBe(false)

    expect(
      isBlobRef({
        // $type: 'blob',
        ref: validBlobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      }),
    ).toBe(false)

    expect(
      isBlobRef({
        $type: 'blob',
        ref: validBlobCid,
        mimeType: { toString: () => 'image/jpeg' },
        size: 10000,
      }),
    ).toBe(false)

    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: { $link: validBlobCid.toString() },
          mimeType: 'image/jpeg',
          size: '10000',
        },
        { strict: true },
      ),
    ).toBe(false)

    expect(
      isBlobRef({
        $type: 'blob',
        mimeType: 'image/jpeg',
        size: 10000,
      }),
    ).toBe(false)

    expect(
      isBlobRef(
        {
          $type: 'blob',
          mimeType: 'image/jpeg',
          size: 10000,
        },
        { strict: true },
      ),
    ).toBe(false)

    expect(isBlobRef('not an object')).toBe(false)
    expect(isBlobRef([])).toBe(false)
    expect(isBlobRef(new Date())).toBe(false)
    expect(isBlobRef(new Map())).toBe(false)
  })

  it('rejects non-integer size', () => {
    expect(
      isBlobRef({
        $type: 'blob',
        ref: validBlobCid,
        mimeType: 'image/jpeg',
        size: 10000.5,
      }),
    ).toBe(false)
  })

  it('rejects invalid CID/multihash code', () => {
    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: validBlobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        },
        { strict: true },
      ),
    ).toBe(true)

    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: invalidBlobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        },
        { strict: true },
      ),
    ).toBe(false)
  })

  it('rejects extra keys', () => {
    expect(
      isBlobRef({
        $type: 'blob',
        ref: validBlobCid,
        mimeType: 'image/jpeg',
        size: 10000,
        extra: 'not allowed',
      }),
    ).toBe(false)

    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: validBlobCid,
          mimeType: 'image/jpeg',
          size: 10000,
          extra: 'not allowed',
        },
        { strict: true },
      ),
    ).toBe(false)
  })

  describe('strict mode', () => {
    it('rejects invalid CID version', () => {
      const cidV0 = parseCid(
        'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', // CID v0
      )
      expect(
        isBlobRef(
          {
            $type: 'blob',
            ref: cidV0,
            mimeType: 'image/jpeg',
            size: 10000,
          },
          { strict: true },
        ),
      ).toBe(false)
    })
  })
})

describe(isLegacyBlobRef, () => {
  it('parses valid legacy blob', () => {
    expect(
      isLegacyBlobRef({
        cid: validBlobCid.toString(),
        mimeType: 'image/jpeg',
      }),
    ).toBe(true)

    expect(
      isLegacyBlobRef({
        cid: invalidBlobCid.toString(),
        mimeType: 'image/jpeg',
      }),
    ).toBe(true)
  })

  it('rejects invalid inputs', () => {
    expect(
      isLegacyBlobRef({
        cid: 'babbaaa',
        mimeType: 'image/jpeg',
      }),
    ).toBe(false)

    expect(
      isLegacyBlobRef({
        cid: 12345,
        mimeType: 'image/jpeg',
      }),
    ).toBe(false)

    expect(
      isLegacyBlobRef({
        mimeType: 'image/jpeg',
      }),
    ).toBe(false)

    expect(
      isLegacyBlobRef({
        cid: invalidBlobCid.toString(),
        mimeType: { toString: () => 'image/jpeg' },
      }),
    ).toBe(false)

    expect(
      isLegacyBlobRef({
        cid: invalidBlobCid.toString(),
        mimeType: 3,
      }),
    ).toBe(false)

    expect(
      isLegacyBlobRef({
        cid: invalidBlobCid.toString(),
        mimeType: '',
      }),
    ).toBe(false)

    expect(isLegacyBlobRef([])).toBe(false)
    expect(isLegacyBlobRef('not an object')).toBe(false)
    expect(isLegacyBlobRef(new Date())).toBe(false)
    expect(isLegacyBlobRef(new Map())).toBe(false)
  })

  it('rejects extra keys', () => {
    expect(
      isLegacyBlobRef({
        cid: validBlobCid.toString(),
        mimeType: 'image/jpeg',
        extra: 'not allowed',
      }),
    ).toBe(false)
  })
})

describe(enumBlobRefs, () => {
  const valid1: BlobRef<RawCid> = {
    $type: 'blob',
    ref: validBlobCid,
    mimeType: 'image/png',
    size: 2048,
  }

  const valid2: BlobRef<RawCid> = {
    $type: 'blob',
    ref: validBlobCid,
    mimeType: 'image/jpeg',
    size: 1024,
  }

  const invalid: BlobRef = {
    $type: 'blob',
    ref: invalidBlobCid,
    mimeType: 'image/jpeg',
    size: 1024,
  }

  const legacy: LegacyBlobRef = {
    cid: validBlobCid.toString(),
    mimeType: 'image/gif',
  }

  const data: LexValue = {
    name: 'example',
    file: { deeply: { nested: { in: { object: { valid1 } } } } },
    attachments: [valid2, invalid, legacy, { description: 'not a blob' }],
  }

  it('enumerates valid BlobRefs by default', () => {
    const refs = Array.from(enumBlobRefs(data))
    expect(refs).toHaveLength(2)
    expect(refs.includes(valid1)).toBe(true)
    expect(refs.includes(valid2)).toBe(true)
  })

  describe('strict support', () => {
    it('enumerates valid BlobRefs in strict mode', () => {
      const refs = Array.from(enumBlobRefs(data, { strict: true }))
      expect(refs).toHaveLength(2)
      expect(refs.includes(valid1)).toBe(true)
      expect(refs.includes(valid2)).toBe(true)
    })

    it('enumerates all BlobRefs in non-strict mode', () => {
      const refs = Array.from(enumBlobRefs(data, { strict: false }))
      expect(refs).toHaveLength(3)
      expect(refs.includes(valid1)).toBe(true)
      expect(refs.includes(valid2)).toBe(true)
      expect(refs.includes(invalid)).toBe(true)
    })
  })

  describe('legacy support', () => {
    it('returns LegacyBlobRefs when legacy option is enabled', () => {
      const refs = Array.from(enumBlobRefs(data, { allowLegacy: true }))
      expect(refs).toHaveLength(3)
      expect(refs.includes(valid1)).toBe(true)
      expect(refs.includes(valid2)).toBe(true)
      expect(refs.includes(legacy)).toBe(true)
    })
  })

  describe('safety', () => {
    it('handles cyclic structures without infinite loops', () => {
      const cyclicArray: LexArray = [valid2]
      const cyclicObject: LexMap = {
        name: 'cyclic',
        blob: valid1,
      }

      // Creating a cycle
      cyclicArray.push(cyclicArray)
      cyclicObject.self = cyclicObject

      const refs = Array.from(
        enumBlobRefs({
          cyclicObject,
          cyclicArray,
        }),
      )
      expect(refs).toHaveLength(2)
      expect(refs.includes(valid1)).toBe(true)
      expect(refs.includes(valid2)).toBe(true)
    })

    it('handles deep structures without exceeding call stack', () => {
      // Creating a deep nested structure
      let deepData: LexMap = { blob: valid1 }
      for (let i = 0; i < 100_000; i++) {
        deepData = { nested: deepData }
      }

      const refs = Array.from(enumBlobRefs(deepData))
      expect(refs).toHaveLength(1)
      expect(refs[0]).toBe(valid1)
    })
  })
})
