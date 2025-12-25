import { isBlobRef, isLegacyBlobRef } from './blob.js'
import { parseCid } from './cid.js'

// await cidForRawBytes(Buffer.from('Hello, World!'))
const blobCid = parseCid(
  'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
)
// await cidForLex(Buffer.from('Hello, World!'))
const lexCid = parseCid(
  'bafyreic52vzks7wdklat4evp3vimohl55i2unzqpshz2ytka5omzr7exdy',
)

describe('isBlobRef', () => {
  it('tests valid blobCid and lexCid', () => {
    expect(blobCid.code).toBe(0x55) // raw
    expect(blobCid.multihash.code).toBe(0x12) // sha2-256
    expect(lexCid.code).toBe(0x71) // dag-cbor
    expect(lexCid.multihash.code).toBe(0x12) // sha2-256
  })

  it('parses valid blob', () => {
    expect(
      isBlobRef({
        $type: 'blob',
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
      }),
    ).toBe(true)

    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: lexCid,
          mimeType: 'image/jpeg',
          size: 10000,
        },
        // In non-strict mode, any CID should be accepted
        { strict: false },
      ),
    ).toBe(true)
  })

  it('rejects invalid inputs', () => {
    expect(
      isBlobRef({
        $type: 'blob',
        ref: { $link: blobCid.toString() },
        mimeType: 'image/jpeg',
        size: '10000',
      }),
    ).toBe(false)
    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: { $link: blobCid.toString() },
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
  })

  it('rejects invalid CID/multihash code', () => {
    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: blobCid,
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
          ref: lexCid,
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
        ref: blobCid,
        mimeType: 'image/jpeg',
        size: 10000,
        extra: 'not allowed',
      }),
    ).toBe(false)

    expect(
      isBlobRef(
        {
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 10000,
          extra: 'not allowed',
        },
        { strict: true },
      ),
    ).toBe(false)
  })
})

describe('isLegacyBlobRef', () => {
  it('parses valid legacy blob', () => {
    expect(
      isLegacyBlobRef({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
      }),
    ).toBe(true)

    expect(
      isLegacyBlobRef({
        cid: lexCid.toString(),
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
  })

  it('rejects extra keys', () => {
    expect(
      isLegacyBlobRef({
        cid: blobCid.toString(),
        mimeType: 'image/jpeg',
        extra: 'not allowed',
      }),
    ).toBe(false)
  })
})
