import assert from 'node:assert'
import { parseLexBlob } from './blob.js'
import { CID } from './cid.js'

describe('parseLexBlob', () => {
  it('parses valid blob', () => {
    const json = {
      $type: 'blob',
      ref: {
        $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
      },
      mimeType: 'image/jpeg',
      size: 10000,
    }
    const blob = parseLexBlob(json)
    assert(blob, 'Expected blob to be parsed successfully')
    expect(blob.$type).toBe('blob')
    expect(blob.ref).toBeInstanceOf(CID)
    expect(typeof blob.mimeType).toBe('string')
    expect(typeof blob.size).toBe('number')
    expect(blob.mimeType).toBe(json.mimeType)
    expect(blob.size).toBe(json.size)
  })

  it('parses nested blob', () => {
    const json = {
      data: {
        file: {
          $type: 'blob',
          ref: {
            $link:
              'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
          },
          mimeType: 'image/jpeg',
          size: 10000,
        },
      },
    }
    const blob = parseLexBlob(json.data.file)
    assert(blob, 'Expected blob to be parsed successfully')
    expect(blob.$type).toBe('blob')
    expect(blob.ref).toBeInstanceOf(CID)
    expect(typeof blob.mimeType).toBe('string')
    expect(typeof blob.size).toBe('number')
    expect(blob.mimeType).toBe(json.data.file.mimeType)
    expect(blob.size).toBe(json.data.file.size)
  })

  describe('strict mode', () => {
    it('rejects blob with invalid CID version', () => {
      // TODO
    })
  })

  describe('invalid inputs', () => {
    for (const { note, json } of [
      {
        note: 'blob with string size',
        json: {
          $type: 'blob',
          ref: {
            $link:
              'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
          },
          mimeType: 'image/jpeg',
          size: '10000',
        },
      },
      {
        note: 'blob with missing key',
        json: {
          $type: 'blob',
          mimeType: 'image/jpeg',
          size: 10000,
        },
      },
    ]) {
      it(note, () => {
        expect(parseLexBlob(json)).toBeUndefined()
      })
    }
  })
})
